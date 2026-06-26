import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

import { createClient } from "../server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

describe("createClient (server)", () => {
  const mockCookieStore = {
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  };
  const mockServerClient = { from: vi.fn(), auth: { getUser: vi.fn() } };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-anon-key";
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never);
    vi.mocked(createServerClient).mockReturnValue(mockServerClient as never);
  });

  it("returns a Supabase server client", async () => {
    const client = await createClient();
    expect(client).toBe(mockServerClient);
  });

  it("calls createServerClient with env vars and cookie handlers", async () => {
    await createClient();
    expect(createServerClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-anon-key",
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    );
  });

  it("getAll delegates to cookieStore.getAll", async () => {
    await createClient();
    const opts = vi.mocked(createServerClient).mock.calls[0][2] as {
      cookies: { getAll: () => unknown; setAll: (c: { name: string; value: string; options?: object }[]) => void };
    };
    opts.cookies.getAll();
    expect(mockCookieStore.getAll).toHaveBeenCalled();
  });

  it("setAll delegates to cookieStore.set for each cookie", async () => {
    await createClient();
    const opts = vi.mocked(createServerClient).mock.calls[0][2] as {
      cookies: { getAll: () => unknown; setAll: (c: { name: string; value: string; options?: object }[]) => void };
    };
    opts.cookies.setAll([{ name: "sb-token", value: "abc", options: { path: "/" } }]);
    expect(mockCookieStore.set).toHaveBeenCalledWith("sb-token", "abc", { path: "/" });
  });

  it("setAll swallows errors from Server Component context", async () => {
    mockCookieStore.set.mockImplementationOnce(() => { throw new Error("Server Component"); });
    await createClient();
    const opts = vi.mocked(createServerClient).mock.calls[0][2] as {
      cookies: { getAll: () => unknown; setAll: (c: { name: string; value: string; options?: object }[]) => void };
    };
    expect(() => opts.cookies.setAll([{ name: "x", value: "y" }])).not.toThrow();
  });
});
