import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

// OAuth 2.1 authorization-server helpers for the MCP connector. All tokens and
// codes are opaque random strings; only their SHA-256 hashes are persisted.
// Verification runs service-side with the service-role key (RLS-bypassing), the
// same trust model as lib/ai/mcp.ts getMcpToolContext.

// ─── Config ───────────────────────────────────────────────────────────────────
export const OAUTH_SCOPE = "mcp";
const ACCESS_TOKEN_TTL_SEC = 60 * 60; // 1 hour
const REFRESH_TOKEN_TTL_SEC = 60 * 60 * 24 * 30; // 30 days
const CODE_TTL_SEC = 60; // 1 minute — codes are single-use and short-lived

// Only these hosts may receive an authorization-code redirect. This prevents an
// open-redirect / code-exfiltration attack. Claude's callback lives on
// claude.ai / claude.com; localhost is allowed for local MCP-inspector testing.
const ALLOWED_REDIRECT_HOSTS = new Set([
  "claude.ai",
  "claude.com",
  "localhost",
  "127.0.0.1",
]);

// ─── Service-role client (mirrors lib/ai/mcp.ts) ──────────────────────────────
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("OAuth store is missing Supabase configuration");
  }
  return createAdminClient<Database>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── Crypto helpers ─────────────────────────────────────────────────────────
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Constant-time compare via fixed-length SHA-256 digests (avoids leaking length
// and avoids timingSafeEqual throwing on unequal-length inputs).
function safeEqual(a: string, b: string): boolean {
  const da = createHash("sha256").update(a).digest();
  const db = createHash("sha256").update(b).digest();
  return timingSafeEqual(da, db);
}

// ─── Canonical resource (RFC 8707 audience) ───────────────────────────────────
export function canonicalResource(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/mcp`;
}

// Accept the client's `resource` if it identifies our MCP endpoint. Tolerates a
// trailing slash and scheme/host case differences, per RFC 8707 guidance.
export function resourceMatches(requested: string, origin: string): boolean {
  const canonical = canonicalResource(origin).toLowerCase();
  return requested.replace(/\/$/, "").toLowerCase() === canonical;
}

// ─── Registered client (single pre-registered confidential client) ────────────
export function getRegisteredClient(): { id: string; secret: string } | null {
  const id = process.env.MCP_OAUTH_CLIENT_ID;
  const secret = process.env.MCP_OAUTH_CLIENT_SECRET;
  if (!id || !secret) return null;
  return { id, secret };
}

export function isValidClientId(clientId: string): boolean {
  const c = getRegisteredClient();
  return c ? safeEqual(clientId, c.id) : false;
}

export function verifyClientSecret(
  clientId: string,
  clientSecret: string | undefined,
): boolean {
  const c = getRegisteredClient();
  if (!c || !clientSecret) return false;
  return safeEqual(clientId, c.id) && safeEqual(clientSecret, c.secret);
}

export function isAllowedRedirectUri(redirectUri: string): boolean {
  try {
    const u = new URL(redirectUri);
    const isLocal = u.hostname === "localhost" || u.hostname === "127.0.0.1";
    if (u.protocol !== "https:" && !isLocal) return false;
    return ALLOWED_REDIRECT_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

// ─── PKCE (S256 only) ─────────────────────────────────────────────────────────
export function verifyPkceS256(
  codeVerifier: string,
  codeChallenge: string,
): boolean {
  const computed = createHash("sha256").update(codeVerifier).digest("base64url");
  const a = Buffer.from(computed);
  const b = Buffer.from(codeChallenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ─── Authorization codes ──────────────────────────────────────────────────────
export type AuthCodeParams = {
  userId: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  scope: string;
  resource: string;
};

export async function issueAuthorizationCode(
  params: AuthCodeParams,
): Promise<string> {
  const code = generateToken();
  const sb = adminClient();
  const { error } = await sb.from("oauth_authorization_codes").insert({
    code_hash: hashToken(code),
    user_id: params.userId,
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
    scope: params.scope,
    resource: params.resource,
    expires_at: new Date(Date.now() + CODE_TTL_SEC * 1000).toISOString(),
  });
  if (error) throw new Error("Failed to persist authorization code");
  return code;
}

// Single-use: deletes the row before returning, so a replay finds nothing.
export async function consumeAuthorizationCode(
  code: string,
): Promise<AuthCodeParams | null> {
  const sb = adminClient();
  const { data, error } = await sb
    .from("oauth_authorization_codes")
    .select("*")
    .eq("code_hash", hashToken(code))
    .maybeSingle();
  if (error || !data) return null;
  await sb.from("oauth_authorization_codes").delete().eq("id", data.id);
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return {
    userId: data.user_id,
    clientId: data.client_id,
    redirectUri: data.redirect_uri,
    codeChallenge: data.code_challenge,
    scope: data.scope,
    resource: data.resource,
  };
}

// ─── Tokens ───────────────────────────────────────────────────────────────────
export type IssuedTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
};

export async function issueTokens(params: {
  userId: string;
  clientId: string;
  scope: string;
  resource: string;
}): Promise<IssuedTokens> {
  const accessToken = generateToken();
  const refreshToken = generateToken();
  const now = Date.now();
  const sb = adminClient();
  const { error } = await sb.from("oauth_tokens").insert({
    access_token_hash: hashToken(accessToken),
    refresh_token_hash: hashToken(refreshToken),
    user_id: params.userId,
    client_id: params.clientId,
    scope: params.scope,
    resource: params.resource,
    access_expires_at: new Date(now + ACCESS_TOKEN_TTL_SEC * 1000).toISOString(),
    refresh_expires_at: new Date(
      now + REFRESH_TOKEN_TTL_SEC * 1000,
    ).toISOString(),
    revoked: false,
  });
  if (error) throw new Error("Failed to persist tokens");
  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SEC,
    scope: params.scope,
  };
}

// Rotating refresh: revokes the presented token and issues a fresh pair.
export async function rotateRefreshToken(
  refreshToken: string,
  clientId: string,
): Promise<IssuedTokens | null> {
  const sb = adminClient();
  const { data, error } = await sb
    .from("oauth_tokens")
    .select("*")
    .eq("refresh_token_hash", hashToken(refreshToken))
    .maybeSingle();
  if (error || !data) return null;
  if (data.revoked || data.client_id !== clientId) return null;
  if (
    data.refresh_expires_at &&
    new Date(data.refresh_expires_at).getTime() < Date.now()
  ) {
    return null;
  }
  await sb.from("oauth_tokens").update({ revoked: true }).eq("id", data.id);
  return issueTokens({
    userId: data.user_id,
    clientId: data.client_id,
    scope: data.scope,
    resource: data.resource,
  });
}

// ─── Access-token verification (resource server) ──────────────────────────────
export type VerifiedToken = {
  userId: string;
  clientId: string;
  scope: string;
  resource: string;
};

export async function verifyAccessToken(
  accessToken: string,
): Promise<VerifiedToken | null> {
  const sb = adminClient();
  const { data, error } = await sb
    .from("oauth_tokens")
    .select("*")
    .eq("access_token_hash", hashToken(accessToken))
    .maybeSingle();
  if (error || !data) return null;
  if (data.revoked) return null;
  if (new Date(data.access_expires_at).getTime() < Date.now()) return null;
  return {
    userId: data.user_id,
    clientId: data.client_id,
    scope: data.scope,
    resource: data.resource,
  };
}

// ─── Authorization Server Metadata (RFC 8414) ─────────────────────────────────
export function authorizationServerMetadata(issuer: string) {
  const base = issuer.replace(/\/$/, "");
  return {
    issuer: base,
    authorization_endpoint: `${base}/api/oauth/authorize`,
    token_endpoint: `${base}/api/oauth/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: [
      "client_secret_post",
      "client_secret_basic",
    ],
    scopes_supported: [OAUTH_SCOPE],
    authorization_response_iss_parameter_supported: true,
  };
}
