-- 016_project_goal_link.sql — link projects to goals (Goal → Project → Task hierarchy)
--
-- Applied 2026-07-15 via the Supabase MCP. Recorded here to keep the append-only
-- migrations history in sync (see 015_oauth.sql for the same pattern).
--
-- projects already has RLS from 003_rls / 007_rls_hardening. Adding a column inherits
-- those policies, so no policy change is required. ON DELETE SET NULL unlinks a
-- project's goal when the goal is deleted (mirrors how deleting a project unlinks its
-- tasks) rather than cascading the delete.

-- ── 1. Schema: goal_id FK + index ─────────────────────────────────────────────

alter table projects
  add column if not exists goal_id uuid references goals(id) on delete set null;

create index if not exists projects_goal_id_idx on projects (goal_id);

comment on column projects.goal_id is
  'Optional parent goal — enables Goal → Project → Task hierarchy. Null when standalone.';

-- ── 2. One-time backfill (idempotent — only rows still unlinked) ───────────────
-- Relinks the 51 tasks bulk-created 2026-07-15 (each title prefixed with its project
-- code, e.g. "L1.1 — …"). Guarded by project_id IS NULL so re-running is a no-op and
-- unrelated null-project tasks (no code prefix) are left untouched. Prefixes are NOT
-- stripped from titles.

update tasks t
set project_id = m.project_id::uuid, updated_at = now()
from (values
  ('L1','6e4f6075-8426-4f37-98a5-7e05190844d9'),
  ('L2','fd999c4a-9a32-4a99-8ceb-7f237f5fe2a2'),
  ('F1','c7238792-107e-4919-a2e0-7729c8df667c'),
  ('F2','31660f43-9a5e-4349-a001-cd1b0a2f492a'),
  ('F3','192440a5-e51f-4893-88c3-3e62d190c40a'),
  ('PR1','999d5b4e-545f-4ab4-b30b-9433699b48b7'),
  ('PR2','de1581b1-536f-4148-9bac-4820455b6717'),
  ('PR3','e0b4ddbd-37cb-4991-8203-2ea6e4bc036b'),
  ('PR4','a267be3d-e18c-41cb-bea7-fa39a22afb07'),
  ('PR5','22f2e6e1-c0a9-4a4e-a5a8-99ca9fa71e8a'),
  ('PE1','f0fa26bc-fc9e-490a-be22-f944800eaf8b'),
  ('PE2','3795dd7c-8eb5-4f96-9af5-5cd2048ab726'),
  ('R1','7c7d4869-b16a-4c72-ad65-0ecc27cb2105'),
  ('R2','5c730a60-4391-46c3-bc88-210cdbf2fed6'),
  ('W1','81a569c5-d364-4b28-95af-238f15eca34d')
) as m(code, project_id)
where t.project_id is null
  and split_part(t.title, '.', 1) = m.code;

-- Relinks each project to its parent goal (guarded by goal_id IS NULL).
update projects p
set goal_id = m.goal_id::uuid, updated_at = now()
from (values
  ('6e4f6075-8426-4f37-98a5-7e05190844d9','40511bbc-c520-42c0-b0a1-6f0d2fb982d8'), -- L1  → Legal
  ('fd999c4a-9a32-4a99-8ceb-7f237f5fe2a2','40511bbc-c520-42c0-b0a1-6f0d2fb982d8'), -- L2  → Legal
  ('c7238792-107e-4919-a2e0-7729c8df667c','14c8be8d-8ecd-49fd-ad98-09989185e586'), -- F1  → Financial
  ('31660f43-9a5e-4349-a001-cd1b0a2f492a','14c8be8d-8ecd-49fd-ad98-09989185e586'), -- F2  → Financial
  ('192440a5-e51f-4893-88c3-3e62d190c40a','14c8be8d-8ecd-49fd-ad98-09989185e586'), -- F3  → Financial
  ('999d5b4e-545f-4ab4-b30b-9433699b48b7','f73f6366-0dcc-42bb-91cc-ef4a54079500'), -- PR1 → Professional
  ('de1581b1-536f-4148-9bac-4820455b6717','f73f6366-0dcc-42bb-91cc-ef4a54079500'), -- PR2 → Professional
  ('e0b4ddbd-37cb-4991-8203-2ea6e4bc036b','f73f6366-0dcc-42bb-91cc-ef4a54079500'), -- PR3 → Professional
  ('a267be3d-e18c-41cb-bea7-fa39a22afb07','f73f6366-0dcc-42bb-91cc-ef4a54079500'), -- PR4 → Professional
  ('22f2e6e1-c0a9-4a4e-a5a8-99ca9fa71e8a','f73f6366-0dcc-42bb-91cc-ef4a54079500'), -- PR5 → Professional
  ('f0fa26bc-fc9e-490a-be22-f944800eaf8b','8a4075a0-c29b-4132-9082-3a06b21e35e0'), -- PE1 → Personal
  ('3795dd7c-8eb5-4f96-9af5-5cd2048ab726','8a4075a0-c29b-4132-9082-3a06b21e35e0'), -- PE2 → Personal
  ('7c7d4869-b16a-4c72-ad65-0ecc27cb2105','64b11382-989d-45c2-a4ce-ebcb23101a62'), -- R1  → Relationships
  ('5c730a60-4391-46c3-bc88-210cdbf2fed6','64b11382-989d-45c2-a4ce-ebcb23101a62'), -- R2  → Relationships
  ('81a569c5-d364-4b28-95af-238f15eca34d','5f1e0eae-992f-4165-b584-41e8e25d3336')  -- W1  → Wellness
) as m(project_id, goal_id)
where p.id = m.project_id::uuid
  and p.goal_id is null;
