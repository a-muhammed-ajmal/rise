import type { TaskAttachment } from '@/lib/types/database'

/** Private Supabase Storage bucket holding task attachments. */
export const TASK_ATTACHMENT_BUCKET = 'task-attachments'

const PATH_MARKERS = [
  `/storage/v1/object/public/${TASK_ATTACHMENT_BUCKET}/`,
  `/storage/v1/object/authenticated/${TASK_ATTACHMENT_BUCKET}/`,
  `/storage/v1/object/sign/${TASK_ATTACHMENT_BUCKET}/`,
]

/**
 * Resolve the storage object key for an attachment.
 *
 * New attachments store `storage_path` directly. Older rows only have a `url`
 * that was built with `getPublicUrl()` against this private bucket — those
 * links never worked, but the object key is still embedded in them, so the
 * path can be recovered without a database backfill.
 *
 * Returns `null` when no key can be determined.
 */
export function attachmentPath(att: TaskAttachment): string | null {
  if (att.storage_path) return att.storage_path
  if (!att.url) return null

  for (const marker of PATH_MARKERS) {
    const at = att.url.indexOf(marker)
    if (at === -1) continue
    const raw = att.url.slice(at + marker.length).split('?')[0]
    if (!raw) return null
    try {
      return decodeURIComponent(raw)
    } catch {
      return raw
    }
  }
  return null
}

/**
 * Make a filename safe to use as a storage object key.
 *
 * `encodeURI` leaves `#`, `?`, `&` and `+` untouched, so a name containing any
 * of them yields a URL that resolves to the wrong object (or to a fragment).
 * The original filename is kept separately for display.
 */
export function sanitizeObjectName(name: string): string {
  const safe = name.replace(/[^\w.\-]+/g, '_').replace(/^_+|_+$/g, '')
  return safe || 'file'
}
