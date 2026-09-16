import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { cachedJwks, resetJwksCache } from "../jwks";

const KEY_SET = {
  keys: [{ kty: "EC", key_ops: ["verify"], kid: "abc", alg: "ES256" }],
};

function mockFetch(impl: () => Promise<Response> | Response) {
  const fn = vi.fn(impl);
  vi.stubGlobal("fetch", fn);
  return fn;
}

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("cachedJwks", () => {
  beforeEach(() => {
    resetJwksCache();
    vi.useFakeTimers();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("fetches the key set from the project's well-known endpoint", async () => {
    const fetchMock = mockFetch(() => ok(KEY_SET));
    await expect(cachedJwks()).resolves.toEqual(KEY_SET);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://test.supabase.co/auth/v1/.well-known/jwks.json",
      { cache: "no-store" },
    );
  });

  // The whole point: the proxy builds a fresh Supabase client per request, so
  // without a module-scoped cache every request would pay for this fetch.
  it("serves later calls from cache without refetching", async () => {
    const fetchMock = mockFetch(() => ok(KEY_SET));
    await cachedJwks();
    await cachedJwks();
    await cachedJwks();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refetches once the TTL has elapsed", async () => {
    const fetchMock = mockFetch(() => ok(KEY_SET));
    await cachedJwks();
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    await cachedJwks();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fetches once when several cold requests race", async () => {
    const fetchMock = mockFetch(() => ok(KEY_SET));
    const results = await Promise.all([
      cachedJwks(),
      cachedJwks(),
      cachedJwks(),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toEqual([KEY_SET, KEY_SET, KEY_SET]);
  });

  it("returns undefined when the endpoint fails and nothing is cached", async () => {
    mockFetch(() => new Response("nope", { status: 500 }));
    await expect(cachedJwks()).resolves.toBeUndefined();
  });

  it("returns undefined when fetch throws and nothing is cached", async () => {
    mockFetch(() => Promise.reject(new Error("offline")));
    await expect(cachedJwks()).resolves.toBeUndefined();
  });

  // A stale key set still verifies every token signed before the rotation, and
  // auth-js refetches for itself on an unknown kid — so serving it beats
  // returning nothing and forcing a per-request fetch during an outage.
  it("serves the stale key set when a refresh fails", async () => {
    let healthy = true;
    mockFetch(() =>
      healthy ? ok(KEY_SET) : Promise.reject(new Error("down")),
    );
    await cachedJwks();
    healthy = false;
    vi.advanceTimersByTime(10 * 60 * 1000 + 1);
    await expect(cachedJwks()).resolves.toEqual(KEY_SET);
  });

  it("rejects a malformed payload rather than caching it", async () => {
    mockFetch(() => ok({ keys: "not-an-array" }));
    await expect(cachedJwks()).resolves.toBeUndefined();
  });

  it("rejects an empty key set", async () => {
    mockFetch(() => ok({ keys: [] }));
    await expect(cachedJwks()).resolves.toBeUndefined();
  });

  it("rejects a body with no keys field", async () => {
    mockFetch(() => ok({ nope: true }));
    await expect(cachedJwks()).resolves.toBeUndefined();
  });

  it("returns undefined without fetching when the project URL is unset", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const fetchMock = mockFetch(() => ok(KEY_SET));
    await expect(cachedJwks()).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
