// Profile photo rules, shared by the Settings upload and mirrored by the
// 'avatars' bucket's own limits (supabase/migrations/20261125090000_avatars_bucket.sql).

/** Accepted image types and the file extension each is saved under. */
export const AVATAR_MIME_EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** 5 MB — the bucket's file_size_limit. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/**
 * Plain-words toast for a failed photo upload, from Supabase Storage's error
 * message. Each setup gap gets its own message, so the toast says what to fix
 * instead of always blaming a missing bucket.
 */
export function avatarUploadErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("bucket not found")) {
    return "Photo storage isn't set up: create the 'avatars' bucket in Supabase Storage";
  }
  if (
    m.includes("row-level security") ||
    m.includes("unauthorized") ||
    m.includes("not allowed")
  ) {
    return "Photo storage needs its upload permission: add the 'avatars' Storage policies";
  }
  if (m.includes("maximum allowed size") || m.includes("too large")) {
    return "Profile photos must be 5 MB or smaller";
  }
  if (m.includes("mime type") || m.includes("not supported")) {
    return "Use a JPG, PNG, WebP, or GIF image";
  }
  return "Photo upload failed. Please try again";
}
