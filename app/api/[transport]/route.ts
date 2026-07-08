import { createMcpHandler } from "mcp-handler";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { executeTool } from "@/lib/ai/execute-tool";
import {
  MCP_TOOLS,
  isMcpAllowedTool,
  verifyMcpAuth,
  getMcpToolContext,
} from "@/lib/ai/mcp";

export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => {
    server.server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: MCP_TOOLS,
    }));

    server.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      if (!isMcpAllowedTool(name)) {
        return {
          content: [
            {
              type: "text",
              text: `Tool "${name}" is not available over MCP.`,
            },
          ],
          isError: true,
        };
      }
      try {
        const ctx = await getMcpToolContext();
        const result = await executeTool(name, args ?? {}, ctx);
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
    });
  },
  {
    capabilities: { tools: {} },
    serverInfo: { name: "rise", version: "1.0.0" },
  },
  { basePath: "/api", maxDuration: 60, disableSse: true },
);

async function authenticatedHandler(request: Request): Promise<Response> {
  if (!verifyMcpAuth(request.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }
  return handler(request);
}

export {
  authenticatedHandler as GET,
  authenticatedHandler as POST,
  authenticatedHandler as DELETE,
};
