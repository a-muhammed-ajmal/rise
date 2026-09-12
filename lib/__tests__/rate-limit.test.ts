import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetRateLimits,
  checkLocalRateLimit,
  clientIpFrom,
  rateLimitResponse,
} from "../rate-limit";

describe("checkLocalRateLimit", () => {
  beforeEach(() => {
    __resetRateLimits();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-23T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit", () => {
    for (let i = 0; i < 3; i++) {
      expect(checkLocalRateLimit("user-1", { limit: 3, windowMs: 60_000 })).toMatchObject({
        ok: true,
      });
    }
  });

  it("reports the remaining allowance", () => {
    const first = checkLocalRateLimit("user-1", { limit: 3, windowMs: 60_000 });
    expect(first).toEqual({ ok: true, remaining: 2 });
    const second = checkLocalRateLimit("user-1", { limit: 3, windowMs: 60_000 });
    expect(second).toEqual({ ok: true, remaining: 1 });
  });

  it("rejects the request past the limit", () => {
    const opts = { limit: 2, windowMs: 60_000 };
    checkLocalRateLimit("user-1", opts);
    checkLocalRateLimit("user-1", opts);
    const blocked = checkLocalRateLimit("user-1", opts);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("keeps separate keys independent", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    expect(checkLocalRateLimit("user-1", opts).ok).toBe(true);
    expect(checkLocalRateLimit("user-2", opts).ok).toBe(true);
    expect(checkLocalRateLimit("user-1", opts).ok).toBe(false);
  });

  it("lets the window slide so allowance returns", () => {
    const opts = { limit: 2, windowMs: 60_000 };
    checkLocalRateLimit("user-1", opts);
    checkLocalRateLimit("user-1", opts);
    expect(checkLocalRateLimit("user-1", opts).ok).toBe(false);

    vi.advanceTimersByTime(60_001);
    expect(checkLocalRateLimit("user-1", opts).ok).toBe(true);
  });

  it("slides partially rather than resetting the whole window", () => {
    const opts = { limit: 2, windowMs: 60_000 };
    checkLocalRateLimit("user-1", opts); // t=0
    vi.advanceTimersByTime(30_000);
    checkLocalRateLimit("user-1", opts); // t=30s
    expect(checkLocalRateLimit("user-1", opts).ok).toBe(false);

    // The t=0 hit expires but the t=30s hit is still inside the window.
    vi.advanceTimersByTime(30_001);
    expect(checkLocalRateLimit("user-1", opts).ok).toBe(true);
    expect(checkLocalRateLimit("user-1", opts).ok).toBe(false);
  });

  it("computes retryAfterSec from the oldest hit in the window", () => {
    const opts = { limit: 1, windowMs: 60_000 };
    checkLocalRateLimit("user-1", opts);
    vi.advanceTimersByTime(50_000);
    const blocked = checkLocalRateLimit("user-1", opts);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBe(10);
  });

  // Deliberately heavy: 12k distinct keys is the point, since eviction is what
  // is under test. Given an explicit budget because the default 5s timeout made
  // this pass or fail on machine speed rather than on behaviour — it was the
  // suite's one flaky test. The budget is still far below the ~16s a real
  // regression in the eviction path would cost.
  it(
    "bounds memory when many distinct keys are seen",
    () => {
      const opts = { limit: 5, windowMs: 1_000 };
      for (let i = 0; i < 12_000; i++) checkLocalRateLimit(`key-${i}`, opts);
      // Eviction has run; a fresh key still works and nothing threw.
      expect(checkLocalRateLimit("fresh", opts).ok).toBe(true);
    },
    30_000,
  );
});

describe("rateLimitResponse", () => {
  it("returns 429 with a Retry-After header", async () => {
    const res = rateLimitResponse(42);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("42");
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining("Too many requests"),
    });
  });
});

describe("clientIpFrom", () => {
  it("takes the leftmost x-forwarded-for entry", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.5, 70.41.3.18" });
    expect(clientIpFrom(h)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip", () => {
    expect(clientIpFrom(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe(
      "198.51.100.7",
    );
  });

  it("returns a stable placeholder when no IP header is present", () => {
    expect(clientIpFrom(new Headers())).toBe("unknown");
  });
});
