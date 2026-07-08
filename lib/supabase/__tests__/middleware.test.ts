import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

import { updateSession } from "../middleware";
import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextRequest } from "next/server";

function makeRequest(pathname: string): NextRequest {
  const url = new URL(pathname, "http://localhost:3000");
  return new NextRequest(url);
}

function setupMockAuth(
  user: { id: string; email?: string } | null,
  opts?: { signOut?: () => Promise<void> },
) {
  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
      signOut: opts?.signOut ?? vi.fn().mockResolvedValue({}),
    },
  };
  vi.mocked(createServerClient).mockReturnValue(mockSupabase as never);
  return mockSupabase;
}

describe("updateSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-key";
  });

  it("redirects unauthenticated users to /login", async () => {
    setupMockAuth(null);
    const response = await updateSession(makeRequest("/productivity"));
    expect(response.headers.get("location")).toContain("/login");
    expect(response.status).toBe(307);
  });

  it("allows unauthenticated access to /login", async () => {
    setupMockAuth(null);
    const response = await updateSession(makeRequest("/login"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows unauthenticated access to /auth paths", async () => {
    setupMockAuth(null);
    const response = await updateSession(makeRequest("/auth/callback"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects authenticated users away from /login to /", async () => {
    setupMockAuth({ id: "user-123" });
    const response = await updateSession(makeRequest("/login"));
    expect(response.headers.get("location")).toContain("/");
    expect(response.status).toBe(307);
  });

  it("passes through authenticated users on app routes", async () => {
    setupMockAuth({ id: "user-123" });
    const response = await updateSession(makeRequest("/productivity"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
  });

  it("blocks user with wrong email and redirects to /login?error=unauthorized", async () => {
    process.env.ALLOWED_USER_EMAIL = "allowed@example.com";
    const signOut = vi.fn().mockResolvedValue({});
    setupMockAuth({ id: "user-456", email: "hacker@example.com" }, { signOut });
    const response = await updateSession(makeRequest("/productivity"));
    expect(signOut).toHaveBeenCalled();
    expect(response.headers.get("location")).toContain("/login");
    expect(response.headers.get("location")).toContain("error=unauthorized");
    delete process.env.ALLOWED_USER_EMAIL;
  });

  it("allows user with matching ALLOWED_USER_EMAIL", async () => {
    process.env.ALLOWED_USER_EMAIL = "writeajmal@gmail.com";
    setupMockAuth({ id: "user-123", email: "writeajmal@gmail.com" });
    const response = await updateSession(makeRequest("/productivity"));
    expect(response.headers.get("location")).toBeNull();
    delete process.env.ALLOWED_USER_EMAIL;
  });

  it("invokes setAll cookie handler when cookies are set", async () => {
    setupMockAuth({ id: "user-123" });
    let capturedSetAll: SetAllCookies | null | undefined = null;
    vi.mocked(createServerClient).mockImplementationOnce((_url, _key, opts) => {
      capturedSetAll = opts.cookies.setAll;
      return {
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: "user-123" } } }),
        },
      } as never;
    });
    await updateSession(makeRequest("/productivity"));
    expect(capturedSetAll).not.toBeNull();
    // Calling setAll should not throw
    expect(() =>
      capturedSetAll!([{ name: "sb-token", value: "abc", options: {} }], {}),
    ).not.toThrow();
  });

  it("passes through cookieless requests to /api/mcp without touching Supabase", async () => {
    setupMockAuth(null);
    const response = await updateSession(makeRequest("/api/mcp"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.status).toBe(200);
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("still redirects unauthenticated requests on other /api paths", async () => {
    setupMockAuth(null);
    const response = await updateSession(makeRequest("/api/push/subscribe"));
    expect(response.headers.get("location")).toContain("/login");
    expect(response.status).toBe(307);
  });

  it("creates Supabase client with correct env vars", async () => {
    setupMockAuth({ id: "user-123" });
    await updateSession(makeRequest("/"));

    expect(createServerClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-key",
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    );
  });
});
