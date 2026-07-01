import { GoogleGenAI } from "@google/genai";
import type { ChatAttachment, ChatAttachmentCategory } from "@/lib/types/database";

// ─── MIME allowlists ───────────────────────────────────────────────────────

const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const FILE_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

const AUDIO_MIMES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
]);

const SIZE_LIMITS: Record<ChatAttachmentCategory, number> = {
  image: 10 * 1024 * 1024,  // 10 MB
  file:  20 * 1024 * 1024,  // 20 MB
  audio: 50 * 1024 * 1024,  // 50 MB
};

// ─── MIME validation ───────────────────────────────────────────────────────

type ValidationOk = { category: ChatAttachmentCategory };
type ValidationErr = { error: string; status: number };

export function validateMimeAndSize(
  mime: string,
  bytes: number,
): ValidationOk | ValidationErr {
  let category: ChatAttachmentCategory;

  if (IMAGE_MIMES.has(mime)) {
    category = "image";
  } else if (FILE_MIMES.has(mime)) {
    category = "file";
  } else if (AUDIO_MIMES.has(mime)) {
    category = "audio";
  } else {
    return {
      error: `File type "${mime}" is not supported. Allowed: images (jpg/png/webp/heic), documents (pdf/doc/docx/csv/xlsx), audio (mp3/m4a/wav/webm).`,
      status: 415,
    };
  }

  if (bytes > SIZE_LIMITS[category]) {
    const limitMB = SIZE_LIMITS[category] / (1024 * 1024);
    return {
      error: `File too large. Maximum size for ${category}s is ${limitMB} MB.`,
      status: 413,
    };
  }

  return { category };
}

// ─── CSV cell escaping ─────────────────────────────────────────────────────

function escapeCsvCell(text: string): string {
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

// ─── Text extraction ───────────────────────────────────────────────────────

export async function extractText(
  buf: Buffer,
  mime: string,
): Promise<string | undefined> {
  try {
    if (mime === "application/pdf") {
      const pdfParse = (await import("pdf-parse")).default;
      const result = await pdfParse(buf);
      return result.text.trim() || undefined;
    }

    if (
      mime === "application/msword" ||
      mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: buf });
      return result.value.trim() || undefined;
    }

    if (mime === "text/csv" || mime === "application/vnd.ms-excel") {
      return buf.toString("utf-8");
    }

    if (
      mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ) {
      const { Workbook } = await import("exceljs");
      const workbook = new Workbook();
      await workbook.xlsx.load(buf);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) return undefined;
      const rows: string[] = [];
      worksheet.eachRow({ includeEmpty: false }, (row) => {
        const cells: string[] = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          cells.push(escapeCsvCell(cell.text));
        });
        rows.push(cells.join(","));
      });
      return rows.join("\n") || undefined;
    }
  } catch {
    // Extraction failure is non-fatal — the file is still stored
    return undefined;
  }

  return undefined;
}

// ─── Audio transcription via Gemini ───────────────────────────────────────

export async function transcribeAudio(
  buf: Buffer,
  mime: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required");
  const genai = new GoogleGenAI({ apiKey });
  const audioB64 = buf.toString("base64");

  const result = await genai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: mime, data: audioB64 } },
          {
            text: "Transcribe this audio verbatim. Return only the transcript, no commentary, labels, or timestamps.",
          },
        ],
      },
    ],
  });

  return result.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// Re-export the type so the route can use it without importing from database.ts
export type { ChatAttachment, ChatAttachmentCategory };
