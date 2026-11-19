import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/format";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { TOOL_HANDLERS } from "@/lib/ai/tool-handlers";
import type { ToolContext, ToolResult } from "@/lib/ai/tool-handlers/shared";

export type { ToolContext, ToolResult } from "@/lib/ai/tool-handlers/shared";

/**
 * Runs one AI tool by name. Handlers live in lib/ai/tool-handlers/, one module
 * per domain; this function only resolves the caller and dispatches.
 *
 * It runs unconditionally when called — the approval gate for destructive tools
 * lives in the chat route, not here.
 */
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  ctx?: ToolContext,
): Promise<ToolResult> {
  let supabase: SupabaseClient<Database>;
  let userId: string;
  if (ctx) {
    supabase = ctx.supabase;
    userId = ctx.userId;
  } else {
    const cookieClient = await createClient();
    const {
      data: { user },
    } = await cookieClient.auth.getUser();
    if (!user) return { success: false, message: "Not authenticated" };
    supabase = cookieClient;
    userId = user.id;
  }

  const handler = TOOL_HANDLERS.get(toolName);
  if (!handler) return { success: false, message: `Unknown tool: ${toolName}` };
  return handler({ input, supabase, userId, today: todayISO() });
}
