// @vitest-environment node
//
// Server route: needs the Node/undici globals. Under the project-wide jsdom
// default, jsdom's File is a different class from the one undici's
// Request.formData() accepts, so the multipart body cannot even be built.
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFileTypeFromBuffer = vi.hoisted(() => vi.fn());
const mockExtractText = vi.hoisted(() => vi.fn());
const mockTranscribeAudio = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("file-type", () => ({ fileTypeFromBuffer: mockFileTypeFromBuffer }));
vi.mock("@/lib/ai/upload-helpers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/ai/upload-helpers")>();
  return {
    ...actual,
    extractText: mockExtractText,
    transcribeAudio: mockTranscribeAudio,
  };
});

import { POST } from "../route";
import { createClient } from "@/lib/supabase/server";
import { __resetRateLimits } from "@/lib/rate-limit";

const USER_ID = "11111111-2222-3333-4444-555555555555";

function setupSupabase(options: { user?: { id: string } | null } = {}) {
  const { user = { id: USER_ID } } = options;
  const upload = vi.fn().mockResolvedValue({ error: null });
  const remove = vi.fn().mockResolvedValue({ error: null });

  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    storage: { from: vi.fn(() => ({ upload, remove })) },
  };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { supabase, upload, remove };
}

function formRequest(
  file: File | null,
  sessionId: string | null,
): Request {
  const form = new FormData();
  if (file) form.append("file", file);
  if (sessionId !== null) form.append("session_id", sessionId);
  return new Request("https://rise.test/api/ai/upload", {
    method: "POST",
    body: form,
  });
}

function makeFile(name: string, type: string, bytes = 1024): File {
  return new File([new ArrayBuffer(bytes)], name, { type });
}

describe("POST /api/ai/upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetRateLimits();
    mockFileTypeFromBuffer.mockResolvedValue({ mime: "application/pdf" });
    mockExtractText.mockResolvedValue("Extracted text.");
    mockTranscribeAudio.mockResolvedValue("A transcript.");
  });

  describe("auth and abuse control", () => {
    it("rejects an unauthenticated caller", async () => {
      setupSupabase({ user: null });
      const res = await POST(formRequest(makeFile("a.pdf", "application/pdf"), "s1"));
      expect(res.status).toBe(401);
    });

    it("rate-limits after the per-minute allowance", async () => {
      setupSupabase();
      for (let i = 0; i < 8; i++) {
        const ok = await POST(
          formRequest(makeFile("a.pdf", "application/pdf"), "s1"),
        );
        expect(ok.status).toBe(200);
      }
      const blocked = await POST(
        formRequest(makeFile("a.pdf", "application/pdf"), "s1"),
      );
      expect(blocked.status).toBe(429);
      expect(blocked.headers.get("retry-after")).toBeTruthy();
    });
  });

  describe("input validation", () => {
    it("rejects a missing file field", async () => {
      setupSupabase();
      const res = await POST(formRequest(null, "s1"));
      expect(res.status).toBe(400);
    });

    it("rejects a traversal session_id before it reaches the storage key", async () => {
      const { upload } = setupSupabase();
      const res = await POST(
        formRequest(makeFile("a.pdf", "application/pdf"), "../other-user"),
      );
      expect(res.status).toBe(400);
      expect(upload).not.toHaveBeenCalled();
    });

    it("rejects a session_id containing a path separator", async () => {
      const { upload } = setupSupabase();
      const res = await POST(
        formRequest(makeFile("a.pdf", "application/pdf"), "a/b"),
      );
      expect(res.status).toBe(400);
      expect(upload).not.toHaveBeenCalled();
    });

    it("rejects an oversized file without buffering it", async () => {
      const { upload } = setupSupabase();
      const huge = makeFile("big.mp3", "audio/mpeg", 60 * 1024 * 1024);
      const res = await POST(formRequest(huge, "s1"));
      expect(res.status).toBe(413);
      expect(upload).not.toHaveBeenCalled();
    });

    it("rejects a file whose per-category limit is exceeded", async () => {
      const { upload } = setupSupabase();
      mockFileTypeFromBuffer.mockResolvedValue({ mime: "image/png" });
      // 12 MB image — under the global ceiling, over the 10 MB image limit.
      const res = await POST(
        formRequest(makeFile("big.png", "image/png", 12 * 1024 * 1024), "s1"),
      );
      expect(res.status).toBe(413);
      expect(upload).not.toHaveBeenCalled();
    });

    // The declared Content-Type is attacker-controlled; magic-byte detection wins.
    it("uses detected content type, not the declared one", async () => {
      const { upload } = setupSupabase();
      mockFileTypeFromBuffer.mockResolvedValue({
        mime: "application/x-msdownload",
      });
      const res = await POST(
        formRequest(makeFile("payload.png", "image/png"), "s1"),
      );
      expect(res.status).toBe(415);
      expect(upload).not.toHaveBeenCalled();
    });

    it("rejects a file whose type cannot be determined", async () => {
      const { upload } = setupSupabase();
      mockFileTypeFromBuffer.mockResolvedValue(undefined);
      const res = await POST(
        formRequest(makeFile("mystery.bin", "application/octet-stream"), "s1"),
      );
      expect(res.status).toBe(415);
      expect(upload).not.toHaveBeenCalled();
    });
  });

  describe("storage path", () => {
    it("scopes the object key to the caller's user id", async () => {
      const { upload } = setupSupabase();
      const res = await POST(
        formRequest(makeFile("notes.pdf", "application/pdf"), "sess-1"),
      );
      expect(res.status).toBe(200);
      const key = upload.mock.calls[0][0] as string;
      expect(key.startsWith(`${USER_ID}/sess-1/`)).toBe(true);
      await expect(res.json()).resolves.toMatchObject({
        storage_path: key,
        category: "file",
        extracted_text: "Extracted text.",
      });
    });

    it("keeps a hostile filename inside a single path segment", async () => {
      const { upload } = setupSupabase();
      await POST(
        formRequest(makeFile("../../evil name.pdf", "application/pdf"), "s1"),
      );
      const key = upload.mock.calls[0][0] as string;
      const segments = key.split("/");

      // Separators are stripped, so the name cannot add depth, and the UUID
      // prefix means the last segment can never be a bare "." or "..".
      expect(segments).toHaveLength(3);
      expect(segments[0]).toBe(USER_ID);
      expect(segments[1]).toBe("s1");
      expect(segments[2]).not.toBe("..");
      expect(segments[2]).toMatch(/^[0-9a-f-]{36}-[A-Za-z0-9._-]+$/);
    });
  });

  // A stored object with no usable text is dead weight in a private bucket.
  describe("cleanup on processing failure", () => {
    it("removes the object when text extraction yields nothing", async () => {
      const { remove } = setupSupabase();
      mockExtractText.mockResolvedValue(undefined);

      const res = await POST(
        formRequest(makeFile("empty.pdf", "application/pdf"), "s1"),
      );
      expect(res.status).toBe(422);
      expect(remove).toHaveBeenCalledTimes(1);
    });

    it("removes the object when extraction throws", async () => {
      const { remove } = setupSupabase();
      mockExtractText.mockRejectedValue(new Error("pdf-parse exploded"));

      const res = await POST(
        formRequest(makeFile("bad.pdf", "application/pdf"), "s1"),
      );
      expect(res.status).toBe(502);
      expect(remove).toHaveBeenCalledTimes(1);
      // The provider's message must not reach the client.
      await expect(res.text()).resolves.not.toContain("pdf-parse");
    });

    it("removes the object when transcription throws", async () => {
      const { remove } = setupSupabase();
      mockFileTypeFromBuffer.mockResolvedValue({ mime: "audio/mpeg" });
      mockTranscribeAudio.mockRejectedValue(new Error("GEMINI_API_KEY missing"));

      const res = await POST(formRequest(makeFile("voice.mp3", "audio/mpeg"), "s1"));
      expect(res.status).toBe(502);
      expect(remove).toHaveBeenCalledTimes(1);
      await expect(res.text()).resolves.not.toContain("GEMINI_API_KEY");
    });

    it("removes the object when transcription returns nothing usable", async () => {
      const { remove } = setupSupabase();
      mockFileTypeFromBuffer.mockResolvedValue({ mime: "audio/mpeg" });
      mockTranscribeAudio.mockResolvedValue("   ");

      const res = await POST(formRequest(makeFile("silent.mp3", "audio/mpeg"), "s1"));
      expect(res.status).toBe(422);
      expect(remove).toHaveBeenCalledTimes(1);
    });

    it("keeps the object when processing succeeds", async () => {
      const { remove } = setupSupabase();
      const res = await POST(
        formRequest(makeFile("notes.pdf", "application/pdf"), "s1"),
      );
      expect(res.status).toBe(200);
      expect(remove).not.toHaveBeenCalled();
    });
  });
});
