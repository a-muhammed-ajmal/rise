import { createMcpHandler, withMcpAuth, getPublicOrigin } from "mcp-handler";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { executeTool } from "@/lib/ai/execute-tool";
import {
  getMcpTools,
  isMcpAllowedTool,
  isStaticMcpToken,
  resolveAllowedUserId,
  getMcpToolContext,
  recordMcpAudit,
} from "@/lib/ai/mcp";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  OAUTH_SCOPE,
  resourceMatches,
  verifyAccessToken,
} from "@/lib/ai/mcp-oauth";

export const maxDuration = 60;

const RESOURCE_METADATA_PATH = "/.well-known/oauth-protected-resource";

const handler = createMcpHandler(
  (server) => {
    server.server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: getMcpTools(),
    }));

    server.server.setRequestHandler(
      CallToolRequestSchema,
      async (request, extra) => {
        const { name, arguments: args } = request.params;
        if (!isMcpAllowedTool(name)) {
          return {
            content: [
              { type: "text", text: `Tool "${name}" is not available over MCP.` },
            ],
            isError: true,
          };
        }
        try {
          const rawUserId = extra.authInfo?.extra?.userId;
          const userId = typeof rawUserId === "string" ? rawUserId : undefined;
          const ctx = await getMcpToolContext(userId);
          const rateLimit = await checkRateLimit(`mcp:${ctx.userId}`, {
            limit: 120,
            windowMs: 60_000,
          });
          if (!rateLimit.ok) {
            return {
              content: [
                {
                  type: "text",
                  text: `Rate limit exceeded. Retry in ${rateLimit.retryAfterSec} seconds.`,
                },
              ],
              isError: true,
            };
          }
          const startedAt = Date.now();
          const result = await executeTool(name, args ?? {}, ctx);
          await recordMcpAudit({
            userId: ctx.userId,
            clientId: extra.authInfo?.clientId ?? "unknown",
            toolName: name,
            args: args ?? {},
            succeeded: result.success,
            durationMs: Date.now() - startedAt,
          });
          return {
            content: [{ type: "text", text: JSON.stringify(result) }],
            isError: !result.success,
          };
        } catch (err) {
          console.error("[api/mcp]", err);
          return {
            content: [
              { type: "text", text: "Tool execution failed. Please try again." },
            ],
            isError: true,
          };
        }
      },
    );
  },
  {
    capabilities: { tools: {} },
    serverInfo: { name: "rise", version: "1.0.0" },
  },
  { basePath: "/api", maxDuration: 60, disableSse: true },
);

// Accepts EITHER the static MCP_ACCESS_TOKEN (Claude Code, unchanged) OR an OAuth
// access token (claude.ai / Desktop). OAuth tokens are audience-bound to this MCP
// endpoint (RFC 8707) — a token minted for a different resource is rejected.
async function verifyMcpToken(
  req: Request,
  bearerToken?: string,
): Promise<AuthInfo | undefined> {
  if (!bearerToken) return undefined;

  if (isStaticMcpToken(bearerToken)) {
    const userId = await resolveAllowedUserId();
    return {
      token: bearerToken,
      clientId: "static",
      scopes: [OAUTH_SCOPE],
      extra: { userId },
    };
  }

  const verified = await verifyAccessToken(bearerToken);
  if (!verified) return undefined;
  if (!resourceMatches(verified.resource, getPublicOrigin(req))) return undefined;
  return {
    token: bearerToken,
    clientId: verified.clientId,
    scopes: verified.scope.split(" ").filter(Boolean),
    extra: { userId: verified.userId },
  };
}

const authHandler = withMcpAuth(handler, verifyMcpToken, {
  required: true,
  resourceMetadataPath: RESOURCE_METADATA_PATH,
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
