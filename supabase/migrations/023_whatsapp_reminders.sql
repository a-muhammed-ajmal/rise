-- ─── 023_whatsapp_reminders.sql ──────────────────────────────────────────────
-- WhatsApp reminder delivery via the Meta Cloud API.
--
-- Two tables:
--   whatsapp_recipients — opt-in phone numbers and which reminder types they get.
--   whatsapp_log        — delivery audit AND the idempotency guard.
--
-- Why the log doubles as the guard: the delivery function runs hourly, but a
-- task due today matches on every one of those runs — without a guard you get
-- the same reminder 24 times. Meta also fails silently on a template mismatch,
-- so with no row per attempt a broken template is indistinguishable from
-- "nothing was due". The unique index on
-- (user_id, reminder_type, entity_id, dedup_key) lets the function CLAIM a slot
-- with ON CONFLICT DO NOTHING before it calls Meta: no row returned means this
-- reminder already went out for that window, so it is skipped.
--
-- entity_id is nullable, and NULLs are distinct in a unique index, so the index
-- is built over coalesce(entity_id, <sentinel>) — otherwise entity-less
-- reminders would never dedup. Written as an expression index rather than
-- NULLS NOT DISTINCT to stay portable across Postgres versions.
--
-- Policy shape mirrors 021: TO authenticated, (select auth.uid()) initplan
-- wrapper, explicit WITH CHECK on every write path.
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── SECTION 1: Recipients ───────────────────────────────────────────────────

create table if not exists whatsapp_recipients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_e164 text not null,
  reminder_types text[] not null default array['habit_nudge', 'crm_followup', 'task_due'],
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Meta rejects anything that is not E.164; fail at write time, not send time.
  constraint whatsapp_recipients_phone_format
    check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

create unique index if not exists whatsapp_recipients_user_phone_key
  on whatsapp_recipients (user_id, phone_e164);
create index if not exists idx_whatsapp_recipients_user_id
  on whatsapp_recipients (user_id);

alter table whatsapp_recipients enable row level security;

drop policy if exists "whatsapp_recipients_select" on whatsapp_recipients;
drop policy if exists "whatsapp_recipients_insert" on whatsapp_recipients;
drop policy if exists "whatsapp_recipients_update" on whatsapp_recipients;
drop policy if exists "whatsapp_recipients_delete" on whatsapp_recipients;

create policy "whatsapp_recipients_select" on whatsapp_recipients
  for select to authenticated
  using ((select auth.uid()) = user_id);
create policy "whatsapp_recipients_insert" on whatsapp_recipients
  for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy "whatsapp_recipients_update" on whatsapp_recipients
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy "whatsapp_recipients_delete" on whatsapp_recipients
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop trigger if exists whatsapp_recipients_updated_at on whatsapp_recipients;
create trigger whatsapp_recipients_updated_at
  before update on whatsapp_recipients
  for each row execute function set_updated_at();

-- ─── SECTION 2: Delivery log / idempotency guard ─────────────────────────────

create table if not exists whatsapp_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references whatsapp_recipients(id) on delete set null,
  phone_e164 text not null,
  reminder_type text not null,
  entity_id uuid,
  -- Window this send belongs to: 'YYYY-MM-DD' for once-a-day reminders,
  -- 'YYYY-MM-DDTHH' where an hourly repeat is intended.
  dedup_key text not null,
  body text not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  http_status integer,
  wa_message_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- The claim. coalesce() so entity-less reminders still dedup.
create unique index if not exists whatsapp_log_dedup_key
  on whatsapp_log (
    user_id,
    reminder_type,
    coalesce(entity_id, '00000000-0000-0000-0000-000000000000'::uuid),
    dedup_key
  );

create index if not exists idx_whatsapp_log_user_id
  on whatsapp_log (user_id);
create index if not exists idx_whatsapp_log_created_at
  on whatsapp_log (created_at desc);

alter table whatsapp_log enable row level security;

-- Read-only to the user: rows are written by the Edge Function under the
-- service role, which bypasses RLS. No client-side insert path exists, so
-- granting one would only widen the surface.
drop policy if exists "whatsapp_log_select" on whatsapp_log;
create policy "whatsapp_log_select" on whatsapp_log
  for select to authenticated
  using ((select auth.uid()) = user_id);
