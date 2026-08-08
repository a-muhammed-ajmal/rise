// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockCreateSupabaseClient = vi.hoisted(() => vi.fn());
const mockGoogleGenAI = vi.hoisted(() => vi.fn());
const mockRunDailyDigestWorkflow = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: mockCreateSupabaseClient,
}));
vi.mock("@google/genai", () => ({ GoogleGenAI: mockGoogleGenAI }));
vi.mock("@/lib/ai/automation", () => ({
  runDailyDigestWorkflow: mockRunDailyDigestWorkflow,
}));

import { POST } from "../route";
import { __resetRateLimits } from "@/lib/rate-limit";

const CRON_SECRET = "a-sufficiently-long-cron-secret";
const USER_ID = "11111111-2222-3333-4444-555555555555";

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://rise.test/api/ai/daily-digest", {
    method: "POST",
    // Distinct IP per call so the rate limiter does not mask auth results.
    headers: { "x-forwarded-for": crypto.randomUUID(), ...headers },
  });
}

describe("POST /api/ai/daily-digest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetRateLimits();
    process.env.CRON_SECRET = CRON_SECRET;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.GEMINI_API_KEY = "gemini-key";
    process.env.ALLOWED_USER_EMAIL = "owner@example.com";

    mockCreateSupabaseClient.mockReturnValue({
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: { users: [{ id: USER_ID, email: "owner@example.com" }] },
          }),
        },
      },
    });
    mockRunDailyDigestWorkflow.mockResolvedValue({
      success: true,
      date: "2026-06-23",
      digestText: "Digest body",
    });
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.ALLOWED_USER_EMAIL;
  });

  describe("rejects spoofed callers before any privileged work", () => {
    // The header the previous implementation accepted as proof of a cron run.
    it("rejects x-vercel-cron: 1", async () => {
      const res = await POST(request({ "x-vercel-cron": "1" }));
      expect(res.status).toBe(401);
      expect(mockCreateSupabaseClient).not.toHaveBeenCalled();
      expect(mockGoogleGenAI).not.toHaveBeenCalled();
      expect(mockRunDailyDigestWorkflow).not.toHaveBeenCalled();
    });

    it("rejects a request with no credentials", async () => {
      const res = await POST(request());
      expect(res.status).toBe(401);
      expect(mockCreateSupabaseClient).not.toHaveBeenCalled();
    });

    it("rejects a wrong bearer token", async () => {
      const res = await POST(request({ authorization: "Bearer wrong-secret" }));
      expect(res.status).toBe(401);
      expect(mockCreateSupabaseClient).not.toHaveBeenCalled();
      expect(mockGoogleGenAI).not.toHaveBeenCalled();
    });

    it("does not leak which credential was wrong", async () => {
      const res = await POST(request({ authorization: "Bearer wrong-secret" }));
      await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
    });
  });

  describe("fails closed on configuration", () => {
    it("returns 503 and does nothing when CRON_SECRET is unset", async () => {
      delete process.env.CRON_SECRET;
      const res = await POST(request({ authorization: `Bearer ${CRON_SECRET}` }));
      expect(res.status).toBe(503);
      expect(mockCreateSupabaseClient).not.toHaveBeenCalled();
    });

    it("returns 503 without naming the missing env var", async () => {
      delete process.env.GEMINI_API_KEY;
      const res = await POST(request({ authorization: `Bearer ${CRON_SECRET}` }));
      expect(res.status).toBe(503);
      const body = await res.text();
      expect(body).toBe(JSON.stringify({ error: "Service unavailable" }));
      expect(body).not.toContain("GEMINI");
    });
  });

  describe("accepts the configured secret", () => {
    it("runs the workflow and reports the digest", async () => {
      const res = await POST(request({ authorization: `Bearer ${CRON_SECRET}` }));
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({
        success: true,
        date: "2026-06-23",
        length: "Digest body".length,
      });
      expect(mockRunDailyDigestWorkflow).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, source: "cron" }),
      );
    });

    it("returns a generic failure when the workflow reports an error", async () => {
      mockRunDailyDigestWorkflow.mockResolvedValue({
        success: false,
        date: "2026-06-23",
        digestText: "",
        error: "Failed to save the digest note",
      });
      const res = await POST(request({ authorization: `Bearer ${CRON_SECRET}` }));
      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toEqual({ error: "Digest failed" });
    });

    it("does not surface a thrown error's message", async () => {
      mockRunDailyDigestWorkflow.mockRejectedValue(
        new Error("connect ECONNREFUSED db.internal:5432"),
      );
      const res = await POST(request({ authorization: `Bearer ${CRON_SECRET}` }));
      expect(res.status).toBe(500);
      await expect(res.text()).resolves.not.toContain("ECONNREFUSED");
    });
  });

  describe("abuse control", () => {
    it("rate-limits repeated attempts from one address", async () => {
      const headers = { "x-forwarded-for": "203.0.113.9" };
      const first = await POST(
        new Request("https://rise.test/api/ai/daily-digest", {
          method: "POST",
          headers,
        }),
      );
      const second = await POST(
        new Request("https://rise.test/api/ai/daily-digest", {
          method: "POST",
          headers,
        }),
      );
      const third = await POST(
        new Request("https://rise.test/api/ai/daily-digest", {
          method: "POST",
          headers,
        }),
      );

      expect(first.status).toBe(401);
      expect(second.status).toBe(401);
      expect(third.status).toBe(429);
    });
  });

  it("exposes no GET handler", async () => {
    const mod = await import("../route");
    expect("GET" in mod).toBe(false);
  });
});
