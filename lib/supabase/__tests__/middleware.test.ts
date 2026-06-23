import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

import { updateSession } from "../middleware";
import { createServerClient } from "@supabase/ssr";
import { NextRequest } from "next/server";

function makeRequest(pathname: string): NextRequest {
  const url = new URL(pathname, "http://localhost:3000");
  return new NextRequest(url);
}

function setupMockAuth(user: { id: string } | null) {
  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
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
