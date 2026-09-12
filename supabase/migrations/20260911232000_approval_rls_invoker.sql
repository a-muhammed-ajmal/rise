-- Replace the signed-in SECURITY DEFINER approval-token function with an
-- invoker-rights implementation backed by narrow owner-only RLS policies.
-- This preserves atomic single-use enforcement while removing elevated
-- execution from the exposed RPC surface.

create policy "approval_token_uses_select" on approval_token_uses
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "approval_token_uses_insert" on approval_token_uses
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "approval_token_uses_delete" on approval_token_uses
  for delete to authenticated
  using ((select auth.uid()) = user_id and expires_at < now());

grant select, insert, delete on approval_token_uses to authenticated;

create or replace function consume_approval_token(
  p_jti uuid,
  p_user_id uuid,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security invoker
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

  delete from public.approval_token_uses
   where user_id = p_user_id and expires_at < now();

  insert into public.approval_token_uses (jti, user_id, expires_at)
  values (p_jti, p_user_id, p_expires_at)
  on conflict (jti) do nothing;
  get diagnostics inserted_count = row_count;

  return inserted_count = 1;
end;
$$;

revoke all on function consume_approval_token(uuid, uuid, timestamptz)
  from public, anon;
grant execute on function consume_approval_token(uuid, uuid, timestamptz)
  to authenticated;

-- The rate-limit table is service-role-only. An explicit deny policy documents
-- that intent and keeps the database advisor from treating missing policies as
-- an accidental omission; service_role continues to bypass RLS.
create policy "rate_limit_buckets_deny_authenticated" on rate_limit_buckets
  for all to authenticated
  using (false)
  with check (false);
