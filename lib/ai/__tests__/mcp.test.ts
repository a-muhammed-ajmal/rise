import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { MCP_TOOLS, isMcpAllowedTool, verifyMcpAuth } from "../mcp";
import { AUTO_TOOLS, APPROVAL_TOOLS, APPROVAL_TOOL_NAMES } from "../tools";
import { createClient } from "@supabase/supabase-js";

describe("MCP_TOOLS", () => {
  it("exposes exactly the AUTO_TOOLS set", () => {
    expect(MCP_TOOLS).toHaveLength(AUTO_TOOLS.length);
  });

  it("contains no approval-gated tool", () => {
    for (const tool of MCP_TOOLS) {
      expect(APPROVAL_TOOL_NAMES.has(tool.name)).toBe(false);
    }
  });
});

describe("isMcpAllowedTool", () => {
  it("allows auto tools", () => {
    expect(isMcpAllowedTool("create_task")).toBe(true);
    expect(isMcpAllowedTool("list_tasks")).toBe(true);
  });

  it("rejects every approval-gated tool", () => {
    for (const tool of APPROVAL_TOOLS) {
      expect(isMcpAllowedTool(tool.name ?? "")).toBe(false);
    }
  });

  it("rejects unknown tool names", () => {
    expect(isMcpAllowedTool("drop_all_tables")).toBe(false);
    expect(isMcpAllowedTool("")).toBe(false);
  });
});

describe("verifyMcpAuth", () => {
  beforeEach(() => {
    process.env.MCP_ACCESS_TOKEN = "secret-token-123";
  });

  afterEach(() => {
    delete process.env.MCP_ACCESS_TOKEN;
  });

  it("accepts a valid bearer token", () => {
    expect(verifyMcpAuth("Bearer secret-token-123")).toBe(true);
  });

  it("rejects a wrong token", () => {
    expect(verifyMcpAuth("Bearer wrong-token")).toBe(false);
  });

  it("rejects tokens of different length without throwing", () => {
    expect(verifyMcpAuth("Bearer x")).toBe(false);
  });

  it("rejects malformed headers", () => {
    expect(verifyMcpAuth("secret-token-123")).toBe(false);
    expect(verifyMcpAuth("Basic secret-token-123")).toBe(false);
    expect(verifyMcpAuth("Bearer ")).toBe(false);
    expect(verifyMcpAuth(null)).toBe(false);
  });

  it("rejects everything when MCP_ACCESS_TOKEN is unset", () => {
    delete process.env.MCP_ACCESS_TOKEN;
    expect(verifyMcpAuth("Bearer secret-token-123")).toBe(false);
  });
});

describe("getMcpToolContext", () => {
  const validEnv = () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.ALLOWED_USER_EMAIL = "owner@example.com";
  };

  // The module caches the resolved context, so each test gets a fresh copy
  const freshImport = async () => {
    vi.resetModules();
    const mod = await import("../mcp");
    return mod.getMcpToolContext;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    validEnv();
  });

  afterEach(() => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.ALLOWED_USER_EMAIL;
  });

  function mockAdminClient(users: { id: string; email?: string }[]) {
    const admin = {
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: { users },
            error: null,
          }),
        },
      },
    };
    vi.mocked(createClient).mockReturnValue(admin as never);
    return admin;
  }

  it("throws when required env vars are missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const getMcpToolContext = await freshImport();
    await expect(getMcpToolContext()).rejects.toThrow(
      "missing required environment configuration",
    );
  });

  it("throws when listUsers fails", async () => {
    const admin = {
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: { users: [] },
            error: { message: "boom" },
          }),
        },
      },
    };
    vi.mocked(createClient).mockReturnValue(admin as never);
    const getMcpToolContext = await freshImport();
    await expect(getMcpToolContext()).rejects.toThrow(
      "Could not resolve the RISE user",
    );
  });

  it("throws when the allowed user is not found", async () => {
    mockAdminClient([{ id: "u-1", email: "someone-else@example.com" }]);
    const getMcpToolContext = await freshImport();
    await expect(getMcpToolContext()).rejects.toThrow("Allowed user not found");
  });

  it("resolves the allowed user and caches the context", async () => {
    const admin = mockAdminClient([
      { id: "u-other", email: "someone-else@example.com" },
      { id: "u-owner", email: "owner@example.com" },
    ]);
    const getMcpToolContext = await freshImport();

    const ctx = await getMcpToolContext();
    expect(ctx.userId).toBe("u-owner");

    const again = await getMcpToolContext();
    expect(again).toBe(ctx);
    expect(admin.auth.admin.listUsers).toHaveBeenCalledTimes(1);
  });
});
