import { createClient } from "@/lib/supabase/server";
import { fileTypeFromBuffer } from "file-type";
import {
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
  if (typeof sessionId !== "string" || !sessionId.trim() || sessionId.length > 64) {
    return new Response("Invalid session_id", { status: 400 });
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
  const uuid = crypto.randomUUID();
  const storagePath = `${user.id}/${sessionId}/${uuid}-${rawName}`;

  // ── Upload to Supabase Storage ──────────────────────────────────────────
  const { error: uploadError } = await supabase.storage
    .from("chat-attachments")
    .upload(storagePath, buf, { contentType: mime, upsert: false });

  if (uploadError) {
    console.error("[upload] storage error:", uploadError.message);
    return new Response("Upload failed. Please try again.", { status: 500 });
  }

  // ── Process attachment (extract text / transcribe) ──────────────────────
  let extracted_text: string | undefined;
  let transcript: string | undefined;

  if (category === "file") {
    extracted_text = await extractText(buf, mime);
  } else if (category === "audio") {
    transcript = await transcribeAudio(buf, mime);
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
