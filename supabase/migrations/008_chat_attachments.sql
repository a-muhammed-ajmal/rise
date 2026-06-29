-- ─── 008_chat_attachments.sql ──────────────────────────────────────────────
-- RLS policies for the chat-attachments storage bucket.
--
-- REQUIRED MANUAL STEP before running this migration:
--   Supabase Dashboard → Storage → New bucket
--   Name: chat-attachments | Public: NO
--
-- Then paste this file into Dashboard → SQL Editor → Run.
-- ──────────────────────────────────────────────────────────────────────────

-- INSERT: authenticated users can only upload to their own user_id/ prefix
CREATE POLICY "chat_attachments_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- SELECT: authenticated users can read only their own uploads
CREATE POLICY "chat_attachments_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- DELETE: authenticated users can remove only their own uploads
CREATE POLICY "chat_attachments_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = (select auth.uid())::text
  );
