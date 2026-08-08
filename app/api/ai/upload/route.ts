import { createClient } from "@/lib/supabase/server";
import { fileTypeFromBuffer } from "file-type";
import { randomUUID } from "crypto";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  MAX_UPLOAD_BYTES,
  isSafeSessionId,
  validateMimeAndSize,
  extractText,
  transcribeAudio,
} from "@/lib/ai/upload-helpers";

export const runtime = "nodejs";
export const maxDuration = 120; // audio transcription can take up to ~90s

export async function POST(request: Request): Promise<Response> {
  // ── Auth ────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // ── Abuse control ───────────────────────────────────────────────────────
  // Transcription bills per request; this is the direct cost ceiling.
  const rl = checkRateLimit(`upload:${user.id}`, { limit: 8, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  // ── Parse form data ─────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response("Invalid form data", { status: 400 });
  }

  const file = formData.get("file");
  const sessionId = formData.get("session_id");

  if (!(file instanceof File)) {
    return new Response("Missing file field", { status: 400 });
  }
  // Must be a safe path segment: this value is interpolated into the storage
  // key, so `..` or `/` would let a caller write outside their own prefix.
  if (typeof sessionId !== "string" || !isSafeSessionId(sessionId)) {
    return new Response("Invalid session_id", { status: 400 });
  }

  // ── Size ceiling before buffering ───────────────────────────────────────
  // Checked against the reported size first so an oversized upload is not read
  // fully into memory before being rejected.
  if (file.size > MAX_UPLOAD_BYTES) {
    return new Response("File too large.", { status: 413 });
  }

  // ── Read bytes ──────────────────────────────────────────────────────────
  const arrayBuffer = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);

  // ── Server-side MIME detection (from file content, not extension) ───────
  const detected = await fileTypeFromBuffer(buf);
  // Fall back to the browser-reported type for plain-text files (CSV)
  // which have no magic bytes. Treat text/* MIME reports as-is when
  // file-type returns undefined.
  const mime = detected?.mime ?? (file.type.startsWith("text/") ? file.type : null);
  if (!mime) {
    return new Response(
      "Cannot determine file type. Only images, documents, and audio files are accepted.",
      { status: 415 },
    );
  }

  // ── Validate MIME + size ────────────────────────────────────────────────
  const validation = validateMimeAndSize(mime, buf.byteLength);
  if ("error" in validation) {
    return new Response(validation.error, { status: validation.status });
  }
  const { category } = validation;

  // ── Sanitise filename ───────────────────────────────────────────────────
  const rawName = file.name.replace(/[^a-zA-Z0-9._\-]/g, "_").slice(0, 200);
  const storagePath = `${user.id}/${sessionId}/${randomUUID()}-${rawName}`;

  // ── Upload to Supabase Storage ──────────────────────────────────────────
  const { error: uploadError } = await supabase.storage
    .from("chat-attachments")
    .upload(storagePath, buf, { contentType: mime, upsert: false });

  if (uploadError) {
    console.error("[upload] storage error:", uploadError.message);
    return new Response("Upload failed. Please try again.", { status: 500 });
  }

  // ── Process attachment (extract text / transcribe) ──────────────────────
  // If processing fails the stored object is useless to the assistant, so it is
  // removed rather than left orphaned in the bucket.
  let extracted_text: string | undefined;
  let transcript: string | undefined;

  try {
    if (category === "file") {
      extracted_text = await extractText(buf, mime);
      if (extracted_text === undefined) {
        await removeQuietly(supabase, storagePath);
        return new Response(
          "Could not read any text from this file. Please try a different format.",
          { status: 422 },
        );
      }
    } else if (category === "audio") {
      transcript = await transcribeAudio(buf, mime);
      if (!transcript.trim()) {
        await removeQuietly(supabase, storagePath);
        return new Response("Could not transcribe this audio. Please try again.", {
          status: 422,
        });
      }
    }
  } catch (err) {
    console.error("[upload] processing failed:", err);
    await removeQuietly(supabase, storagePath);
    return new Response("Could not process this file. Please try again.", {
      status: 502,
    });
  }

  // ── Return attachment metadata ──────────────────────────────────────────
  return Response.json({
    storage_path: storagePath,
    filename: file.name,
    mime_type: mime,
    size_bytes: buf.byteLength,
    category,
    ...(extracted_text !== undefined ? { extracted_text } : {}),
    ...(transcript !== undefined ? { transcript } : {}),
  });
}

async function removeQuietly(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storagePath: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from("chat-attachments")
    .remove([storagePath]);
  if (error) {
    console.error("[upload] cleanup failed for", storagePath, error.message);
  }
}
