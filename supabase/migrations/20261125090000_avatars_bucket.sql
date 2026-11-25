-- ─── 20261125090000_avatars_bucket.sql ──────────────────────────────────────
-- Profile photos (Settings → Profile). The app has always uploaded to an
-- 'avatars' bucket, but no migration created it, so every upload failed with
-- "Bucket not found".
--
-- PUBLIC, deliberately — unlike chat-attachments and task-attachments.
--   The photo's URL is saved in user_metadata.avatar_url and the Topbar renders
--   it on every page. A private bucket would need a fresh signed URL on every
--   navigation (an extra Storage round trip in app/(app)/layout.tsx), or a URL
--   that expires underneath the saved metadata. A profile photo is not
--   sensitive, and each object is named "<user-id>/avatar-<random uuid>.<ext>",
--   so a URL cannot be guessed. Public affects only READ by URL; writing and
--   deleting still need the policies below.
--
-- Storage itself enforces the same limits as the client (lib/avatar.ts):
-- 5 MB, and JPG / PNG / WebP / GIF only.
--
-- POLICIES ARE A DASHBOARD STEP — see migration 020 and README → "Storage
-- policies": the SQL editor cannot create policies on storage.objects on this
-- project. Under Dashboard → Storage → avatars → Policies, role `authenticated`:
--   INSERT (WITH CHECK)  bucket_id = 'avatars' AND (storage.foldername(name))[1] = (select auth.uid())::text
--   SELECT (USING)       same expression — remove() needs it to find the old photo
--   DELETE (USING)       same expression
-- No UPDATE policy: uploads use upsert: false (same reasoning as migration 020).
--
-- Safe to re-run.
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── Verification ────────────────────────────────────────────────────────────
--
--   select id, public, file_size_limit, allowed_mime_types
--   from storage.buckets where id = 'avatars';
--   -- expect: public = true, 5242880, {image/jpeg,image/png,image/webp,image/gif}
--
--   select policyname, cmd from pg_policies
--   where schemaname = 'storage' and tablename = 'objects'
--     and policyname ilike '%avatar%';
--   -- expect three rows after the Dashboard step: INSERT, SELECT, DELETE
