-- 017_task_form_v3.sql — Task form redesign (TaskFlow spec)
--
-- Run manually via the Supabase Dashboard SQL editor. Append-only history — do not
-- edit 001–016 (see 016_project_goal_link.sql for the same recorded-here pattern).
--
-- Two additions, both consistent with existing conventions:
--
--   1. tasks.reminders (jsonb) — multiple reminders per task. The legacy single
--      `reminder timestamptz` column is KEPT for backward-compat and the send-push
--      edge function; the app mirrors the earliest reminder into `reminder` until
--      send-push is updated to iterate the array.
--
--   2. task_labels — a per-user label catalog carrying a chosen color. Mirrors the
--      goals→milestones / habits→habit_logs child-table pattern: denormalized user_id
--      with ON DELETE CASCADE, the standard 4 RLS policies, and a user_id index.
--      `tasks.labels text[]` stays as the per-task assignment; color is looked up by
--      name, falling back to a deterministic hash for uncatalogued labels.
--
-- Both tables already have RLS from 003_rls / 007_rls_hardening. Adding a column to
-- `tasks` inherits its policies, so no policy change is needed there (as in 016).

-- ── 1. tasks.reminders (jsonb array) ─────────────────────────────────────────
-- Shape: [{ "id": uuid, "type": "relative"|"absolute", "offset_minutes"?: int, "at"?: timestamptz }]
--   relative → fire offset_minutes before the due time; absolute → fire at the exact moment.

alter table tasks
  add column if not exists reminders jsonb not null default '[]'::jsonb;

comment on column tasks.reminders is
  'Multiple reminders: [{id,type:relative|absolute,offset_minutes?,at?}]. Legacy `reminder` mirrors the earliest for send-push back-compat.';

-- ── 1b. tasks.description_rich (jsonb) ───────────────────────────────────────
-- Structured Tiptap document for the rich-text notes editor. `description text`
-- is KEPT as the plain-text mirror (editor.getText()) so AI tools, semantic search,
-- and card previews keep working unchanged. Rendered only via a read-only Tiptap
-- instance — never dangerouslySetInnerHTML — so there is no stored-HTML XSS surface.

alter table tasks
  add column if not exists description_rich jsonb;

comment on column tasks.description_rich is
  'Tiptap JSON for rich notes. description text mirrors the plain text for AI/search/preview.';

-- ── 2. task_labels catalog (name → color, per user) ──────────────────────────

create table if not exists task_labels (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users on delete cascade,
  name       text not null,
  color      text not null default '#6366f1',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create index if not exists idx_task_labels_user_id on task_labels (user_id);

comment on table task_labels is
  'Per-user label catalog carrying a chosen color. tasks.labels text[] holds the assignment; color is resolved by name.';

-- RLS — same shape as every other user-data table (007_rls_hardening pattern).
alter table task_labels enable row level security;

drop policy if exists "task_labels_select" on task_labels;
drop policy if exists "task_labels_insert" on task_labels;
drop policy if exists "task_labels_update" on task_labels;
drop policy if exists "task_labels_delete" on task_labels;

create policy "task_labels_select" on task_labels
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "task_labels_insert" on task_labels
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "task_labels_update" on task_labels
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "task_labels_delete" on task_labels
  for delete to authenticated using ((select auth.uid()) = user_id);
