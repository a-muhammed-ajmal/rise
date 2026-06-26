-- ─── Task Enhancements Migration ────────────────────────────────────────────
-- Adds: due_time, reminder_at, is_starred, tags, subtasks,
--       estimated_minutes, attachments

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS due_time        time,
  ADD COLUMN IF NOT EXISTS reminder_at     timestamptz,
  ADD COLUMN IF NOT EXISTS is_starred      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tags            text[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS subtasks        jsonb   NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS estimated_minutes int,
  ADD COLUMN IF NOT EXISTS attachments     jsonb   NOT NULL DEFAULT '[]';

-- Index for starred tasks (used by Today tab Focus section)
CREATE INDEX IF NOT EXISTS tasks_is_starred_idx ON tasks (user_id, is_starred)
  WHERE is_starred = true;

-- Index for tags (GIN for array containment queries)
CREATE INDEX IF NOT EXISTS tasks_tags_idx ON tasks USING GIN (tags);

-- Storage bucket for task attachments
-- NOTE: Create a bucket named "task-attachments" in Supabase Dashboard
-- Then run the policies below:

-- INSERT policy: authenticated users can upload to their own folder
-- (run manually in Dashboard SQL editor after creating the bucket)
--
-- CREATE POLICY "Users can upload task attachments"
--   ON storage.objects FOR INSERT
--   TO authenticated
--   WITH CHECK (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
--
-- SELECT policy: authenticated users can view their own attachments
-- CREATE POLICY "Users can view own task attachments"
--   ON storage.objects FOR SELECT
--   TO authenticated
--   USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
--
-- DELETE policy
-- CREATE POLICY "Users can delete own task attachments"
--   ON storage.objects FOR DELETE
--   TO authenticated
--   USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);
