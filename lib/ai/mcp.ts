import { createHash, timingSafeEqual } from "crypto";
import {
  createClient as createAdminClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
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

// ─── Static token (Claude Code path) ──────────────────────────────────────────
// The long-lived MCP_ACCESS_TOKEN grants full access as the single allowed user.
// Kept for backward compatibility alongside OAuth; constant-time, fails closed.
export function isStaticMcpToken(token: string | undefined): boolean {
  const expected = process.env.MCP_ACCESS_TOKEN;
  if (!expected || !token) return false;
  const provided = createHash("sha256").update(token).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(provided, expectedDigest);
}

// Header-form check (kept for the existing bearer tests).
export function verifyMcpAuth(authorizationHeader: string | null): boolean {
  if (!authorizationHeader) return false;
  const [scheme, ...rest] = authorizationHeader.split(" ");
  if (scheme !== "Bearer") return false;
  return isStaticMcpToken(rest.join(" "));
}

// ─── Service-role context ─────────────────────────────────────────────────────
let cachedAdmin: SupabaseClient<Database> | null = null;
let cachedAllowedUserId: string | null = null;
let cachedContext: ToolContext | null = null;

function getAdmin(): SupabaseClient<Database> {
  if (cachedAdmin) return cachedAdmin;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "MCP endpoint is missing required environment configuration",
    );
  }
  cachedAdmin = createAdminClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cachedAdmin;
}

// Resolves the single ALLOWED_USER_EMAIL user id (cached per warm instance).
export async function resolveAllowedUserId(): Promise<string> {
  if (cachedAllowedUserId) return cachedAllowedUserId;
  const allowedEmail = process.env.ALLOWED_USER_EMAIL;
  if (!allowedEmail) {
    throw new Error(
      "MCP endpoint is missing required environment configuration",
    );
  }
  const supabase = getAdmin();
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error) throw new Error("Could not resolve the RISE user for MCP access");
  const user = data.users.find((u) => u.email === allowedEmail);
  if (!user) throw new Error("Allowed user not found for MCP access");
  cachedAllowedUserId = user.id;
  return user.id;
}

// Returns the service-role tool context for the given user. Without an explicit
// userId (static-token / default path) it resolves the single allowed user and
// caches the context object (identity-stable across calls for the same user).
export async function getMcpToolContext(userId?: string): Promise<ToolContext> {
  const resolvedUserId = userId ?? (await resolveAllowedUserId());
  if (cachedContext && cachedContext.userId === resolvedUserId) {
    return cachedContext;
  }
  cachedContext = { supabase: getAdmin(), userId: resolvedUserId };
  return cachedContext;
}
