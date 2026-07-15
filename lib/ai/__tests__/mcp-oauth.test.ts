import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@supabase/supabase-js";
import {
  generateToken,
  hashToken,
  verifyPkceS256,
  canonicalResource,
  resourceMatches,
  isAllowedRedirectUri,
  isValidClientId,
  verifyClientSecret,
  authorizationServerMetadata,
  issueAuthorizationCode,
  consumeAuthorizationCode,
  issueTokens,
  verifyAccessToken,
  rotateRefreshToken,
} from "../mcp-oauth";
import { createHash } from "crypto";

// ─── Minimal in-memory Supabase mock (supports the exact chains mcp-oauth uses) ─
type Row = Record<string, unknown>;
interface QueryBuilder {
  insert(row: Row | Row[]): Promise<{ data: null; error: null }>;
  select(cols?: string): QueryBuilder;
  update(patch: Row): QueryBuilder;
  delete(): QueryBuilder;
  eq(col: string, val: unknown): QueryBuilder;
  maybeSingle(): Promise<{ data: Row | null; error: null }>;
  then(resolve: (v: { data: null; error: null }) => void): void;
}

function createInMemorySupabase() {
  const tables: Record<string, Row[]> = {};
  function from(table: string): QueryBuilder {
    const store = (tables[table] ??= []);
    const filters: Array<[string, unknown]> = [];
    let mode: "update" | "delete" | null = null;
    let patch: Row = {};
    const matches = (r: Row) => filters.every(([c, v]) => r[c] === v);
    const applyTerminal = () => {
      if (mode === "update") store.filter(matches).forEach((r) => Object.assign(r, patch));
      if (mode === "delete")
        store
          .filter(matches)
          .forEach((r) => store.splice(store.indexOf(r), 1));
      return { data: null, error: null } as const;
    };
    const builder: QueryBuilder = {
      insert(row) {
        (Array.isArray(row) ? row : [row]).forEach((r) => store.push({ ...r }));
        return Promise.resolve({ data: null, error: null });
      },
      select() {
        return builder;
      },
      update(p) {
        mode = "update";
        patch = p;
        return builder;
      },
      delete() {
        mode = "delete";
        return builder;
      },
      eq(col, val) {
        filters.push([col, val]);
        return builder;
      },
      maybeSingle() {
        const match = store.find(matches);
        return Promise.resolve({ data: match ? { ...match } : null, error: null });
      },
      then(resolve) {
        resolve(applyTerminal());
      },
    };
    return builder;
  }
  return { from };
}

describe("mcp-oauth pure helpers", () => {
  it("hashToken is deterministic and matches SHA-256", () => {
    expect(hashToken("abc")).toBe(
      createHash("sha256").update("abc").digest("hex"),
    );
  });

  it("generateToken returns unique url-safe strings", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("verifyPkceS256 accepts the matching verifier and rejects others", () => {
    const verifier = "the-code-verifier-value-1234567890";
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    expect(verifyPkceS256(verifier, challenge)).toBe(true);
    expect(verifyPkceS256("wrong-verifier", challenge)).toBe(false);
  });

  it("canonicalResource / resourceMatches enforce the MCP audience", () => {
    const origin = "https://rise.example.com";
    expect(canonicalResource(origin)).toBe("https://rise.example.com/api/mcp");
    expect(resourceMatches("https://rise.example.com/api/mcp", origin)).toBe(true);
    expect(resourceMatches("https://rise.example.com/api/mcp/", origin)).toBe(true); // trailing slash
    expect(resourceMatches("https://EVIL.com/api/mcp", origin)).toBe(false);
  });

  it("isAllowedRedirectUri allows Claude hosts and rejects others", () => {
    expect(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(isAllowedRedirectUri("https://claude.com/anything")).toBe(true);
    expect(isAllowedRedirectUri("https://evil.example.com/cb")).toBe(false);
    expect(isAllowedRedirectUri("http://claude.ai/cb")).toBe(false); // non-https
    expect(isAllowedRedirectUri("not a url")).toBe(false);
  });

  it("authorizationServerMetadata advertises PKCE + iss support", () => {
    const m = authorizationServerMetadata("https://rise.example.com/");
    expect(m.issuer).toBe("https://rise.example.com");
    expect(m.code_challenge_methods_supported).toEqual(["S256"]);
    expect(m.authorization_response_iss_parameter_supported).toBe(true);
    expect(m.token_endpoint).toBe("https://rise.example.com/api/oauth/token");
  });
});

describe("mcp-oauth client verification", () => {
  beforeEach(() => {
    process.env.MCP_OAUTH_CLIENT_ID = "client-abc";
    process.env.MCP_OAUTH_CLIENT_SECRET = "super-secret";
  });
  afterEach(() => {
    delete process.env.MCP_OAUTH_CLIENT_ID;
    delete process.env.MCP_OAUTH_CLIENT_SECRET;
  });

  it("accepts the registered client and rejects wrong credentials", () => {
    expect(isValidClientId("client-abc")).toBe(true);
    expect(isValidClientId("client-xyz")).toBe(false);
    expect(verifyClientSecret("client-abc", "super-secret")).toBe(true);
    expect(verifyClientSecret("client-abc", "nope")).toBe(false);
    expect(verifyClientSecret("client-abc", undefined)).toBe(false);
  });

  it("rejects everything when no client is configured", () => {
    delete process.env.MCP_OAUTH_CLIENT_ID;
    delete process.env.MCP_OAUTH_CLIENT_SECRET;
    expect(isValidClientId("client-abc")).toBe(false);
    expect(verifyClientSecret("client-abc", "super-secret")).toBe(false);
  });
});

describe("mcp-oauth code + token store", () => {
  const CODE_PARAMS = {
    userId: "user-1",
    clientId: "client-abc",
    redirectUri: "https://claude.ai/api/mcp/auth_callback",
    codeChallenge: "challenge-xyz",
    scope: "mcp",
    resource: "https://rise.example.com/api/mcp",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-15T12:00:00Z"));
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    vi.mocked(createClient).mockReturnValue(createInMemorySupabase() as never);
  });
  afterEach(() => {
    vi.useRealTimers();
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("issues and consumes an authorization code exactly once", async () => {
    const code = await issueAuthorizationCode(CODE_PARAMS);
    const first = await consumeAuthorizationCode(code);
    expect(first?.userId).toBe("user-1");
    expect(first?.codeChallenge).toBe("challenge-xyz");
    // single-use: a replay finds nothing
    const second = await consumeAuthorizationCode(code);
    expect(second).toBeNull();
  });

  it("rejects an expired authorization code", async () => {
    const code = await issueAuthorizationCode(CODE_PARAMS);
    vi.setSystemTime(new Date("2026-07-15T12:05:00Z")); // +5 min (code TTL is 60s)
    expect(await consumeAuthorizationCode(code)).toBeNull();
  });

  it("issues tokens and verifies the access token", async () => {
    const t = await issueTokens(CODE_PARAMS);
    const verified = await verifyAccessToken(t.accessToken);
    expect(verified?.userId).toBe("user-1");
    expect(verified?.resource).toBe("https://rise.example.com/api/mcp");
  });

  it("rejects an expired access token", async () => {
    const t = await issueTokens(CODE_PARAMS);
    vi.setSystemTime(new Date("2026-07-15T14:00:00Z")); // +2h (access TTL is 1h)
    expect(await verifyAccessToken(t.accessToken)).toBeNull();
  });

  it("rotates refresh tokens and revokes the old one", async () => {
    const t = await issueTokens(CODE_PARAMS);
    const rotated = await rotateRefreshToken(t.refreshToken, "client-abc");
    expect(rotated?.accessToken).toBeTruthy();
    expect(rotated?.accessToken).not.toBe(t.accessToken);
    // the old refresh token is now revoked — cannot rotate again
    expect(await rotateRefreshToken(t.refreshToken, "client-abc")).toBeNull();
  });

  it("rejects a refresh token presented by the wrong client", async () => {
    const t = await issueTokens(CODE_PARAMS);
    expect(await rotateRefreshToken(t.refreshToken, "client-other")).toBeNull();
  });
});
