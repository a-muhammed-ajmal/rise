-- ─── 008_chat_attachments.sql ──────────────────────────────────────────────
-- RLS policies for the chat-attachments storage bucket.
--
-- REQUIRED MANUAL STEP before running this migration:
--   Supabase Dashboard → Storage → New bucket
--   Name: chat-attachments | Public: NO
--
-- Then paste this file into Dashboard → SQL Editor → Run.
-- ──────────────────────────────────────────────────────────────────────────

-- Enable RLS on core storage tables
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- BUCKET SELECT: Authenticated users must be able to resolve the bucket
DROP POLICY IF EXISTS chat_attachments_bucket_select ON storage.buckets;
CREATE POLICY chat_attachments_bucket_select
  ON storage.buckets FOR SELECT
  TO authenticated
  USING (name = 'chat-attachments');

-- INSERT: Authenticated users can only upload to their own user_id/ prefix
DROP POLICY IF EXISTS chat_attachments_insert_own ON storage.objects;
CREATE POLICY chat_attachments_insert_own
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND owner = auth.uid()
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- SELECT: Authenticated users can read only their own uploads
DROP POLICY IF EXISTS chat_attachments_select_own ON storage.objects;
CREATE POLICY chat_attachments_select_own
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- UPDATE: Authenticated users can update/overwrite their own uploads
DROP POLICY IF EXISTS chat_attachments_update_own ON storage.objects;
CREATE POLICY chat_attachments_update_own
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND split_part(name, '/', 1) = auth.uid()::text
  );

-- DELETE: Authenticated users can remove only their own uploads
DROP POLICY IF EXISTS chat_attachments_delete_own ON storage.objects;
CREATE POLICY chat_attachments_delete_own
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND split_part(name, '/', 1) = auth.uid()::text
  );