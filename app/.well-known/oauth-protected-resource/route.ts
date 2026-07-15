import {
  protectedResourceHandler,
  metadataCorsOptionsRequestHandler,
  getPublicOrigin,
} from "mcp-handler";

// RFC 9728 Protected Resource Metadata. Tells MCP clients (Claude) that this
// server's tokens are issued by our own authorization server (same origin).
export function GET(req: Request): Response {
  const origin = getPublicOrigin(req);
  return protectedResourceHandler({
    authServerUrls: [origin],
    resourceUrl: `${origin}/api/mcp`,
  })(req);
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
