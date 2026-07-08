import { createHash, timingSafeEqual } from "crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { AUTO_TOOLS, APPROVAL_TOOL_NAMES } from "@/lib/ai/tools";
import {
  toMcpToolDefinitions,
  type McpToolDefinition,
} from "@/lib/ai/mcp-schema";
import type { ToolContext } from "@/lib/ai/execute-tool";
import type { Database } from "@/lib/types/database";

// Only auto-safe tools are exposed over MCP; APPROVAL_TOOLS stay behind the
// in-app ConfirmDialog gate (see CLAUDE.md guardrails)
export const MCP_TOOLS: McpToolDefinition[] = toMcpToolDefinitions(AUTO_TOOLS);

const MCP_TOOL_NAMES = new Set(MCP_TOOLS.map((t) => t.name));

export function isMcpAllowedTool(name: string): boolean {
  return MCP_TOOL_NAMES.has(name) && !APPROVAL_TOOL_NAMES.has(name);
}

export function verifyMcpAuth(authorizationHeader: string | null): boolean {
  const expected = process.env.MCP_ACCESS_TOKEN;
  if (!expected || !authorizationHeader) return false;
  const [scheme, ...rest] = authorizationHeader.split(" ");
  const provided = rest.join(" ");
  if (scheme !== "Bearer" || !provided) return false;
  // Hash both sides so timingSafeEqual accepts inputs of unequal length
  const providedDigest = createHash("sha256").update(provided).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

let cachedContext: ToolContext | null = null;

export async function getMcpToolContext(): Promise<ToolContext> {
  if (cachedContext) return cachedContext;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const allowedEmail = process.env.ALLOWED_USER_EMAIL;
  if (!supabaseUrl || !serviceRoleKey || !allowedEmail) {
    throw new Error(
      "MCP endpoint is missing required environment configuration",
    );
  }

  const supabase = createAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw new Error("Could not resolve the RISE user for MCP access");
  const user = data.users.find((u) => u.email === allowedEmail);
  if (!user) throw new Error("Allowed user not found for MCP access");

  cachedContext = { supabase, userId: user.id };
  return cachedContext;
}
