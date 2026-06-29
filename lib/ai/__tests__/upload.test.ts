import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist shared mock instances so they're available inside vi.mock() ──────

const mockGenerateContent = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    candidates: [
      {
        content: {
          parts: [{ text: "Hello from the transcript." }],
        },
      },
    ],
  }),
);

// ── Mocks must be hoisted before imports of the module under test ──────────

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function (
    this: Record<string, unknown>,
  ) {
    this.models = { generateContent: mockGenerateContent };
  }),
}));

vi.mock("pdf-parse", () => ({
  default: vi.fn().mockResolvedValue({ text: "Extracted PDF text." }),
}));

vi.mock("mammoth", () => ({
  extractRawText: vi.fn().mockResolvedValue({ value: "Extracted Word text." }),
}));

vi.mock("xlsx", () => ({
  read: vi.fn().mockReturnValue({
    SheetNames: ["Sheet1"],
    Sheets: { Sheet1: {} },
  }),
  utils: {
    sheet_to_csv: vi.fn().mockReturnValue("col1,col2\nval1,val2"),
  },
}));

import { validateMimeAndSize, extractText, transcribeAudio } from "../upload-helpers";
import pdfParse from "pdf-parse";
import * as mammoth from "mammoth";
import * as XLSX from "xlsx";

// ─── validateMimeAndSize ──────────────────────────────────────────────────

describe("validateMimeAndSize", () => {
  describe("allowed types", () => {
    it("accepts image/jpeg and returns image category", () => {
      const result = validateMimeAndSize("image/jpeg", 1024);
      expect(result).toEqual({ category: "image" });
    });

    it("accepts image/png and returns image category", () => {
      expect(validateMimeAndSize("image/png", 100)).toEqual({ category: "image" });
    });

    it("accepts image/webp", () => {
      expect(validateMimeAndSize("image/webp", 100)).toEqual({ category: "image" });
    });

    it("accepts image/heic", () => {
      expect(validateMimeAndSize("image/heic", 100)).toEqual({ category: "image" });
    });

    it("accepts image/heif", () => {
      expect(validateMimeAndSize("image/heif", 100)).toEqual({ category: "image" });
    });

    it("accepts application/pdf and returns file category", () => {
      expect(validateMimeAndSize("application/pdf", 1024)).toEqual({ category: "file" });
    });

    it("accepts text/csv and returns file category", () => {
      expect(validateMimeAndSize("text/csv", 512)).toEqual({ category: "file" });
    });

    it("accepts application/vnd.openxmlformats-officedocument.wordprocessingml.document", () => {
      const mime =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      expect(validateMimeAndSize(mime, 1024)).toEqual({ category: "file" });
    });

    it("accepts application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", () => {
      const mime =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      expect(validateMimeAndSize(mime, 1024)).toEqual({ category: "file" });
    });

    it("accepts audio/webm and returns audio category", () => {
      expect(validateMimeAndSize("audio/webm", 1024)).toEqual({ category: "audio" });
    });

    it("accepts audio/mpeg", () => {
      expect(validateMimeAndSize("audio/mpeg", 1024)).toEqual({ category: "audio" });
    });

    it("accepts audio/wav", () => {
      expect(validateMimeAndSize("audio/wav", 1024)).toEqual({ category: "audio" });
    });
  });

  describe("disallowed types", () => {
    it("returns 415 for video/mp4", () => {
      const result = validateMimeAndSize("video/mp4", 1024);
      expect(result).toMatchObject({ status: 415 });
    });

    it("returns 415 for application/zip", () => {
      const result = validateMimeAndSize("application/zip", 1024);
      expect(result).toMatchObject({ status: 415 });
    });

    it("returns 415 for text/html", () => {
      const result = validateMimeAndSize("text/html", 1024);
      expect(result).toMatchObject({ status: 415 });
    });

    it("includes helpful error message listing allowed types", () => {
      const result = validateMimeAndSize("video/mp4", 1024);
      expect("error" in result && result.error).toMatch(/images.*documents.*audio/i);
    });
  });

  describe("size limits", () => {
    const MB = 1024 * 1024;

    it("returns 413 for image exceeding 10 MB", () => {
      const result = validateMimeAndSize("image/jpeg", 11 * MB);
      expect(result).toMatchObject({ status: 413 });
    });

    it("accepts image at exactly 10 MB", () => {
      const result = validateMimeAndSize("image/jpeg", 10 * MB);
      expect(result).toEqual({ category: "image" });
    });

    it("returns 413 for file exceeding 20 MB", () => {
      const result = validateMimeAndSize("application/pdf", 21 * MB);
      expect(result).toMatchObject({ status: 413 });
    });

    it("accepts file at exactly 20 MB", () => {
      const result = validateMimeAndSize("application/pdf", 20 * MB);
      expect(result).toEqual({ category: "file" });
    });

    it("returns 413 for audio exceeding 50 MB", () => {
      const result = validateMimeAndSize("audio/webm", 51 * MB);
      expect(result).toMatchObject({ status: 413 });
    });

    it("accepts audio at exactly 50 MB", () => {
      const result = validateMimeAndSize("audio/webm", 50 * MB);
      expect(result).toEqual({ category: "audio" });
    });

    it("error message includes the limit in MB", () => {
      const result = validateMimeAndSize("image/jpeg", 11 * MB);
      expect("error" in result && result.error).toMatch(/10 MB/);
    });
  });
});

// ─── extractText ──────────────────────────────────────────────────────────

describe("extractText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls pdf-parse for application/pdf and returns extracted text", async () => {
    const buf = Buffer.from("fake pdf");
    const result = await extractText(buf, "application/pdf");
    expect(pdfParse).toHaveBeenCalledWith(buf);
    expect(result).toBe("Extracted PDF text.");
  });

  it("calls mammoth for docx MIME and returns extracted text", async () => {
    const buf = Buffer.from("fake docx");
    const mime =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const result = await extractText(buf, mime);
    expect(mammoth.extractRawText).toHaveBeenCalledWith({ buffer: buf });
    expect(result).toBe("Extracted Word text.");
  });

  it("calls mammoth for application/msword", async () => {
    const buf = Buffer.from("fake doc");
    await extractText(buf, "application/msword");
    expect(mammoth.extractRawText).toHaveBeenCalled();
  });

  it("returns raw UTF-8 string for text/csv", async () => {
    const csvContent = "name,age\nAlice,30\nBob,25";
    const buf = Buffer.from(csvContent, "utf-8");
    const result = await extractText(buf, "text/csv");
    expect(result).toBe(csvContent);
  });

  it("returns raw string for application/vnd.ms-excel (legacy xls treated as CSV)", async () => {
    const buf = Buffer.from("a,b\n1,2", "utf-8");
    const result = await extractText(buf, "application/vnd.ms-excel");
    expect(result).toBe("a,b\n1,2");
  });

  it("calls xlsx.read for spreadsheetml.sheet and returns CSV string", async () => {
    const buf = Buffer.from("fake xlsx");
    const mime =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const result = await extractText(buf, mime);
    expect(XLSX.read).toHaveBeenCalledWith(buf, { type: "buffer" });
    expect(result).toBe("col1,col2\nval1,val2");
  });

  it("returns undefined for image MIME (not a file category)", async () => {
    const result = await extractText(Buffer.from("img"), "image/jpeg");
    expect(result).toBeUndefined();
  });

  it("returns undefined and does not throw when pdf-parse throws", async () => {
    vi.mocked(pdfParse).mockRejectedValueOnce(new Error("corrupt PDF"));
    const result = await extractText(Buffer.from("bad pdf"), "application/pdf");
    expect(result).toBeUndefined();
  });

  it("returns undefined when XLSX sheet list is empty", async () => {
    vi.mocked(XLSX.read).mockReturnValueOnce({
      SheetNames: [],
      Sheets: {},
    });
    const mime =
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const result = await extractText(Buffer.from("fake"), mime);
    expect(result).toBeUndefined();
  });
});

// ─── transcribeAudio ─────────────────────────────────────────────────────

describe("transcribeAudio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-apply the default mock response after clearAllMocks
    mockGenerateContent.mockResolvedValue({
      candidates: [
        { content: { parts: [{ text: "Hello from the transcript." }] } },
      ],
    });
    process.env.GEMINI_API_KEY = "test-gemini-key";
  });

  it("calls Gemini generateContent with inlineData and transcription prompt", async () => {
    const buf = Buffer.from("fake audio bytes");
    const mime = "audio/webm";

    await transcribeAudio(buf, mime);

    expect(mockGenerateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-2.5-flash",
        contents: [
          expect.objectContaining({
            role: "user",
            parts: expect.arrayContaining([
              expect.objectContaining({
                inlineData: expect.objectContaining({
                  mimeType: "audio/webm",
                  data: buf.toString("base64"),
                }),
              }),
            ]),
          }),
        ],
      }),
    );
  });

  it("returns the transcript text from Gemini response", async () => {
    const result = await transcribeAudio(Buffer.from("audio"), "audio/mpeg");
    expect(result).toBe("Hello from the transcript.");
  });

  it("returns empty string when Gemini returns no candidates", async () => {
    mockGenerateContent.mockResolvedValueOnce({ candidates: [] });
    const result = await transcribeAudio(Buffer.from("audio"), "audio/wav");
    expect(result).toBe("");
  });

  it("returns empty string when candidate has no text part", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      candidates: [{ content: { parts: [] } }],
    });
    const result = await transcribeAudio(Buffer.from("audio"), "audio/wav");
    expect(result).toBe("");
  });
});
