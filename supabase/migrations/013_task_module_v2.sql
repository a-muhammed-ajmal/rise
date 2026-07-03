-- ─── Task Module v2 ──────────────────────────────────────────────────────────
-- Priority: urgent/high/medium/low → P1/P2/P3/P4
-- Status: add blocked + on_hold, retire inbox → todo
-- Field renames: tags→labels, recurrence_rule→recurrence,
--               reminder_at→reminder, estimated_minutes→estimated_time
-- Drop: is_recurring (implied by recurrence IS NOT NULL)
-- Add: is_focus, focus_date, comments, activity, linked_tasks, location

-- ── 1. Priority values ────────────────────────────────────────────────────────

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_check;

UPDATE tasks SET priority =
  CASE priority
    WHEN 'urgent' THEN 'P1'
    WHEN 'high'   THEN 'P2'
    WHEN 'medium' THEN 'P3'
    WHEN 'low'    THEN 'P4'
    ELSE priority
  END;

ALTER TABLE tasks
  ALTER COLUMN priority SET DEFAULT 'P3',
  ADD CONSTRAINT tasks_priority_check CHECK (priority IN ('P1','P2','P3','P4'));

-- ── 2. Status values ─────────────────────────────────────────────────────────

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Retire inbox: move all inbox tasks to todo
UPDATE tasks SET status = 'todo' WHERE status = 'inbox';

ALTER TABLE tasks
  ALTER COLUMN status SET DEFAULT 'todo',
  ADD CONSTRAINT tasks_status_check CHECK (status IN ('todo','in_progress','blocked','on_hold','done'));

-- ── 3. Column renames ─────────────────────────────────────────────────────────

ALTER TABLE tasks RENAME COLUMN tags            TO labels;
ALTER TABLE tasks RENAME COLUMN recurrence_rule TO recurrence;
ALTER TABLE tasks RENAME COLUMN reminder_at     TO reminder;
ALTER TABLE tasks RENAME COLUMN estimated_minutes TO estimated_time;

-- Update GIN index to use the new column name
DROP INDEX IF EXISTS tasks_tags_idx;
CREATE INDEX IF NOT EXISTS tasks_labels_idx ON tasks USING GIN (labels);

-- ── 4. Drop is_recurring ──────────────────────────────────────────────────────

ALTER TABLE tasks DROP COLUMN IF EXISTS is_recurring;

-- ── 5. New columns ────────────────────────────────────────────────────────────

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS is_focus     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS focus_date   date,
  ADD COLUMN IF NOT EXISTS comments     jsonb   NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS activity     jsonb   NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS linked_tasks jsonb   NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS location     text;

-- Index for focus mode (Today tab focus section)
CREATE INDEX IF NOT EXISTS tasks_is_focus_idx ON tasks (user_id, is_focus, focus_date)
  WHERE is_focus = true;
