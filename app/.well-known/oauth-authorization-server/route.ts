import { getPublicOrigin, metadataCorsOptionsRequestHandler } from "mcp-handler";
import { authorizationServerMetadata } from "@/lib/ai/mcp-oauth";

// RFC 8414 Authorization Server Metadata. Advertises our authorize/token
// endpoints, PKCE (S256), and the RFC 9207 iss parameter support to MCP clients.
export function GET(req: Request): Response {
  const meta = authorizationServerMetadata(getPublicOrigin(req));
  return Response.json(meta, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
