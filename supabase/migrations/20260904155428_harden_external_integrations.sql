-- 024_harden_external_integrations.sql
-- Atomic OAuth credentials, persistent approval replay protection, distributed
-- rate limiting, notification delivery idempotency, MCP audit logging, and a
-- complete single-user data export.

-- All server-only tables have RLS enabled with no user policies. Functions that
-- must be reachable by the signed-in app explicitly verify auth.uid(); every
-- other function is executable by service_role only.

-- ─── OAuth authorization-code consumption ───────────────────────────────────

create or replace function consume_oauth_authorization_code(p_code_hash text)
returns table (
  user_id uuid,
  client_id text,
  redirect_uri text,
  code_challenge text,
  scope text,
  resource text
)
language sql
security invoker
set search_path = public, pg_temp
as $$
  with consumed as (
    delete from public.oauth_authorization_codes
    where code_hash = p_code_hash
    returning *
  )
  select
    consumed.user_id,
    consumed.client_id,
    consumed.redirect_uri,
    consumed.code_challenge,
    consumed.scope,
    consumed.resource
  from consumed
  where consumed.expires_at >= now();
$$;

revoke all on function consume_oauth_authorization_code(text) from public, anon, authenticated;
grant execute on function consume_oauth_authorization_code(text) to service_role;

-- Locking the presented refresh-token row makes rotation a single transaction.
-- A concurrent replay waits for the first rotation, observes revoked=true, and
-- revokes every successor for this user/client before returning reuse.
create or replace function rotate_oauth_refresh_token(
  p_refresh_token_hash text,
  p_client_id text,
  p_access_token_hash text,
  p_new_refresh_token_hash text,
  p_access_expires_at timestamptz,
  p_refresh_expires_at timestamptz
)
returns table (
  rotation_status text,
  user_id uuid,
  scope text,
  resource text
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  current_token public.oauth_tokens%rowtype;
begin
  select token.*
    into current_token
    from public.oauth_tokens as token
   where token.refresh_token_hash = p_refresh_token_hash
   for update;

  if not found or current_token.client_id <> p_client_id then
    return query select 'invalid'::text, null::uuid, null::text, null::text;
    return;
  end if;

  if current_token.revoked then
    update public.oauth_tokens
       set revoked = true
     where oauth_tokens.user_id = current_token.user_id
       and oauth_tokens.client_id = current_token.client_id
       and oauth_tokens.revoked = false;
    return query select 'reuse'::text, current_token.user_id,
      current_token.scope, current_token.resource;
    return;
  end if;

  if current_token.refresh_expires_at is null
     or current_token.refresh_expires_at < now() then
    update public.oauth_tokens set revoked = true where id = current_token.id;
    return query select 'expired'::text, current_token.user_id,
      current_token.scope, current_token.resource;
    return;
  end if;

  update public.oauth_tokens set revoked = true where id = current_token.id;

  insert into public.oauth_tokens (
    access_token_hash,
    refresh_token_hash,
    user_id,
    client_id,
    scope,
    resource,
    access_expires_at,
    refresh_expires_at,
    revoked
  ) values (
    p_access_token_hash,
    p_new_refresh_token_hash,
    current_token.user_id,
    current_token.client_id,
    current_token.scope,
    current_token.resource,
    p_access_expires_at,
    p_refresh_expires_at,
    false
  );

  return query select 'rotated'::text, current_token.user_id,
    current_token.scope, current_token.resource;
end;
$$;

revoke all on function rotate_oauth_refresh_token(text, text, text, text, timestamptz, timestamptz)
  from public, anon, authenticated;
grant execute on function rotate_oauth_refresh_token(text, text, text, text, timestamptz, timestamptz)
  to service_role;

-- ─── Signed approval replay protection ──────────────────────────────────────

create table if not exists approval_token_uses (
  jti uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists approval_token_uses_expiry_idx
  on approval_token_uses (expires_at);
create index if not exists approval_token_uses_user_idx
  on approval_token_uses (user_id);

alter table approval_token_uses enable row level security;

create or replace function consume_approval_token(
  p_jti uuid,
  p_user_id uuid,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  inserted_count integer;
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then
    raise exception 'approval token owner mismatch';
  end if;

  if p_expires_at < now() then
    return false;
  end if;

  delete from public.approval_token_uses where expires_at < now();

  insert into public.approval_token_uses (jti, user_id, expires_at)
  values (p_jti, p_user_id, p_expires_at)
  on conflict (jti) do nothing;
  get diagnostics inserted_count = row_count;

  return inserted_count = 1;
end;
$$;

revoke all on function consume_approval_token(uuid, uuid, timestamptz) from public, anon;
grant execute on function consume_approval_token(uuid, uuid, timestamptz) to authenticated;

-- ─── Distributed rate limiting ──────────────────────────────────────────────

create table if not exists rate_limit_buckets (
  key_hash text not null,
  window_started_at timestamptz not null,
  hit_count integer not null check (hit_count > 0),
  primary key (key_hash, window_started_at)
);

create index if not exists rate_limit_buckets_expiry_idx
  on rate_limit_buckets (window_started_at);

alter table rate_limit_buckets enable row level security;

create or replace function check_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  current_epoch bigint := floor(extract(epoch from clock_timestamp()))::bigint;
  bucket_epoch bigint;
  bucket_start timestamptz;
  next_count integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'invalid rate-limit configuration';
  end if;

  bucket_epoch := (current_epoch / p_window_seconds) * p_window_seconds;
  bucket_start := to_timestamp(bucket_epoch);

  insert into public.rate_limit_buckets (key_hash, window_started_at, hit_count)
  values (p_key_hash, bucket_start, 1)
  on conflict (key_hash, window_started_at)
  do update set hit_count = public.rate_limit_buckets.hit_count + 1
  returning hit_count into next_count;

  delete from public.rate_limit_buckets
   where window_started_at < clock_timestamp() - interval '1 day';

  return query select
    next_count <= p_limit,
    greatest(p_limit - next_count, 0),
    greatest((bucket_epoch + p_window_seconds - current_epoch)::integer, 1);
end;
$$;

revoke all on function check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function check_rate_limit(text, integer, integer) to service_role;

-- ─── Push delivery log / idempotency guard ──────────────────────────────────

create table if not exists push_notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references push_subscriptions(id) on delete set null,
  reminder_type text not null check (reminder_type in ('habit_nudge', 'crm_followup')),
  entity_id uuid,
  dedup_key text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  http_status integer,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create unique index if not exists push_notification_log_dedup_idx
  on push_notification_log (
    user_id,
    subscription_id,
    reminder_type,
    coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    dedup_key
  );

create index if not exists push_notification_log_user_created_idx
  on push_notification_log (user_id, created_at desc);
create index if not exists push_notification_log_subscription_idx
  on push_notification_log (subscription_id);

alter table push_notification_log enable row level security;

create policy "push_notification_log_select" on push_notification_log
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- ─── MCP audit trail ─────────────────────────────────────────────────────────

create table if not exists mcp_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  tool_name text not null,
  input_hash text not null,
  succeeded boolean not null,
  duration_ms integer not null check (duration_ms >= 0),
  created_at timestamptz not null default now()
);

create index if not exists mcp_audit_log_user_created_idx
  on mcp_audit_log (user_id, created_at desc);

alter table mcp_audit_log enable row level security;

create policy "mcp_audit_log_select" on mcp_audit_log
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- ─── Complete user data export ───────────────────────────────────────────────

create or replace function export_current_user_data()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'exported_at', now(),
    'projects', coalesce((select jsonb_agg(to_jsonb(x)) from public.projects x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'tasks', coalesce((select jsonb_agg(to_jsonb(x)) from public.tasks x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'task_labels', coalesce((select jsonb_agg(to_jsonb(x)) from public.task_labels x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'goals', coalesce((select jsonb_agg(to_jsonb(x)) from public.goals x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'milestones', coalesce((select jsonb_agg(to_jsonb(x)) from public.milestones x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'reviews', coalesce((select jsonb_agg(to_jsonb(x)) from public.reviews x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'journal_entries', coalesce((select jsonb_agg(to_jsonb(x)) from public.journal_entries x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(to_jsonb(x)) from public.categories x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'payment_methods', coalesce((select jsonb_agg(to_jsonb(x)) from public.payment_methods x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'transactions', coalesce((select jsonb_agg(to_jsonb(x)) from public.transactions x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'budgets', coalesce((select jsonb_agg(to_jsonb(x)) from public.budgets x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'debts', coalesce((select jsonb_agg(to_jsonb(x)) from public.debts x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'habits', coalesce((select jsonb_agg(to_jsonb(x)) from public.habits x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'habit_logs', coalesce((select jsonb_agg(to_jsonb(x)) from public.habit_logs x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'focus_sessions', coalesce((select jsonb_agg(to_jsonb(x)) from public.focus_sessions x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'contacts', coalesce((select jsonb_agg(to_jsonb(x)) from public.contacts x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'interactions', coalesce((select jsonb_agg(to_jsonb(x)) from public.interactions x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'notes', coalesce((select jsonb_agg(to_jsonb(x)) from public.notes x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'documents', coalesce((select jsonb_agg(to_jsonb(x)) from public.documents x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(to_jsonb(x)) from public.links x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'ai_conversations', coalesce((select jsonb_agg(to_jsonb(x)) from public.ai_conversations x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'ai_memory', coalesce((select jsonb_agg(to_jsonb(x) - 'embedding') from public.ai_memory x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'user_profile', coalesce((select jsonb_agg(to_jsonb(x)) from public.user_profile x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'whatsapp_recipients', coalesce((select jsonb_agg(to_jsonb(x)) from public.whatsapp_recipients x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'whatsapp_log', coalesce((select jsonb_agg(to_jsonb(x)) from public.whatsapp_log x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'push_notification_log', coalesce((select jsonb_agg(to_jsonb(x)) from public.push_notification_log x where x.user_id = (select auth.uid())), '[]'::jsonb),
    'mcp_audit_log', coalesce((select jsonb_agg(to_jsonb(x)) from public.mcp_audit_log x where x.user_id = (select auth.uid())), '[]'::jsonb)
  )
  where (select auth.uid()) is not null;
$$;

revoke all on function export_current_user_data() from public, anon;
grant execute on function export_current_user_data() to authenticated;

-- ─── Additional live-row indexes for module pagination ──────────────────────

create index if not exists idx_transactions_user_live_date
  on transactions (user_id, date desc) where deleted_at is null;
create index if not exists idx_tasks_user_live_created
  on tasks (user_id, created_at desc) where deleted_at is null;
create index if not exists idx_habits_user_live_name
  on habits (user_id, name) where deleted_at is null;

-- ─── Foreign-key indexes surfaced by the Supabase database advisor ─────────

create index if not exists idx_focus_sessions_task_id
  on focus_sessions (task_id);
create index if not exists idx_interactions_contact_id
  on interactions (contact_id);
create index if not exists idx_milestones_goal_id
  on milestones (goal_id);
create index if not exists idx_oauth_authorization_codes_user_id
  on oauth_authorization_codes (user_id);
create index if not exists idx_oauth_tokens_user_id
  on oauth_tokens (user_id);
create index if not exists idx_whatsapp_log_recipient_id
  on whatsapp_log (recipient_id);
