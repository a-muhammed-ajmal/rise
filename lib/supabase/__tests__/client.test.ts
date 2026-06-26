import { describe, it, expect, vi, beforeEach } from "vitest";

const mockClient = { from: vi.fn(), auth: { getUser: vi.fn() } };

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: vi.fn(() => mockClient),
}));

import { createClient } from "../client";
import { createBrowserClient } from "@supabase/ssr";

describe("createClient (browser)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-anon-key";
  });

  it("returns a Supabase browser client", () => {
    const client = createClient();
    expect(client).toBe(mockClient);
  });

  it("calls createBrowserClient with env vars", () => {
    createClient();
    expect(createBrowserClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "test-anon-key",
    );
  });
});
