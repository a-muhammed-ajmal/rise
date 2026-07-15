-- 015_oauth.sql — OAuth 2.1 authorization-server storage for the MCP connector.
--
-- These tables are touched ONLY by the service-role server code in
-- lib/ai/mcp-oauth.ts (the OAuth authorize/token endpoints and the /api/mcp
-- resource-server token check). No client, and not even the authenticated user,
-- reads them directly. The secure posture is therefore: enable RLS and add NO
-- policies — anon and authenticated roles are denied by default, and the
-- service role bypasses RLS. (Mirrors how getMcpToolContext already operates.)
--
-- Tokens/codes are never stored in plaintext: only their SHA-256 hashes are kept,
-- so a DB leak does not expose usable credentials.

-- ─── Authorization codes (short-lived, single-use) ───────────────────────────
create table if not exists oauth_authorization_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  redirect_uri text not null,
  code_challenge text not null,
  code_challenge_method text not null default 'S256',
  scope text not null default 'mcp',
  resource text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists oauth_auth_codes_expires_idx
  on oauth_authorization_codes (expires_at);

alter table oauth_authorization_codes enable row level security;
-- No policies: service-role only.

-- ─── Access / refresh tokens ─────────────────────────────────────────────────
create table if not exists oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  access_token_hash text not null unique,
  refresh_token_hash text unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  scope text not null default 'mcp',
  resource text not null,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists oauth_tokens_access_idx
  on oauth_tokens (access_token_hash);
create index if not exists oauth_tokens_refresh_idx
  on oauth_tokens (refresh_token_hash);

alter table oauth_tokens enable row level security;
-- No policies: service-role only.
