import { describe, it, expect } from "vitest";
import {
  TASK_ATTACHMENT_BUCKET,
  attachmentPath,
  sanitizeObjectName,
} from "../task-attachments";

const USER = "40ac522b-1111-2222-3333-444455556666";

describe("attachmentPath", () => {
  it("prefers an explicit storage_path", () => {
    expect(
      attachmentPath({ name: "a.pdf", type: "application/pdf", storage_path: `${USER}/1-a.pdf` }),
    ).toBe(`${USER}/1-a.pdf`);
  });

  it("recovers the path from a legacy public URL", () => {
    const att = {
      name: "shot.jpg",
      type: "image/jpeg",
      url: `https://x.supabase.co/storage/v1/object/public/${TASK_ATTACHMENT_BUCKET}/${USER}/1785401796564-shot.jpg`,
    };
    expect(attachmentPath(att)).toBe(`${USER}/1785401796564-shot.jpg`);
  });

  it("decodes percent-encoded characters in a legacy URL", () => {
    const att = {
      name: "Offer letter.pdf",
      type: "application/pdf",
      url: `https://x.supabase.co/storage/v1/object/public/${TASK_ATTACHMENT_BUCKET}/${USER}/1-Offer%20letter.pdf`,
    };
    expect(attachmentPath(att)).toBe(`${USER}/1-Offer letter.pdf`);
  });

  it("strips a query string from a legacy URL", () => {
    const att = {
      name: "a.pdf",
      type: "application/pdf",
      url: `https://x.supabase.co/storage/v1/object/public/${TASK_ATTACHMENT_BUCKET}/${USER}/1-a.pdf?t=123`,
    };
    expect(attachmentPath(att)).toBe(`${USER}/1-a.pdf`);
  });

  it("also recovers from an authenticated-style URL", () => {
    const att = {
      name: "a.pdf",
      type: "application/pdf",
      url: `https://x.supabase.co/storage/v1/object/authenticated/${TASK_ATTACHMENT_BUCKET}/${USER}/1-a.pdf`,
    };
    expect(attachmentPath(att)).toBe(`${USER}/1-a.pdf`);
  });

  it("returns null when there is neither a path nor a URL", () => {
    expect(attachmentPath({ name: "a.pdf", type: "application/pdf" })).toBeNull();
  });

  it("returns null for a URL pointing at another bucket", () => {
    const att = {
      name: "a.pdf",
      type: "application/pdf",
      url: "https://x.supabase.co/storage/v1/object/public/chat-attachments/u/1-a.pdf",
    };
    expect(attachmentPath(att)).toBeNull();
  });

  it("returns null for a non-storage URL", () => {
    expect(
      attachmentPath({ name: "a.pdf", type: "application/pdf", url: "https://example.com/a.pdf" }),
    ).toBeNull();
  });

  it("returns null when the URL has no path after the bucket", () => {
    const att = {
      name: "a.pdf",
      type: "application/pdf",
      url: `https://x.supabase.co/storage/v1/object/public/${TASK_ATTACHMENT_BUCKET}/`,
    };
    expect(attachmentPath(att)).toBeNull();
  });

  it("returns the raw key when the URL holds a malformed percent sequence", () => {
    const att = {
      name: "a.pdf",
      type: "application/pdf",
      url: `https://x.supabase.co/storage/v1/object/public/${TASK_ATTACHMENT_BUCKET}/${USER}/1-100%.pdf`,
    };
    expect(attachmentPath(att)).toBe(`${USER}/1-100%.pdf`);
  });

  it("ignores an empty storage_path and falls back to the URL", () => {
    const att = {
      name: "a.pdf",
      type: "application/pdf",
      storage_path: "",
      url: `https://x.supabase.co/storage/v1/object/public/${TASK_ATTACHMENT_BUCKET}/${USER}/1-a.pdf`,
    };
    expect(attachmentPath(att)).toBe(`${USER}/1-a.pdf`);
  });
});

describe("sanitizeObjectName", () => {
  it("keeps a plain filename intact", () => {
    expect(sanitizeObjectName("report.pdf")).toBe("report.pdf");
  });

  it("replaces characters that break URLs", () => {
    // '#' would become a fragment, '?' and '&' query separators — encodeURI
    // does not escape any of them.
    expect(sanitizeObjectName("notes #2 v1&2?.pdf")).toBe("notes_2_v1_2_.pdf");
  });

  it("collapses runs of unsafe characters into one underscore", () => {
    expect(sanitizeObjectName("a   b.txt")).toBe("a_b.txt");
  });

  it("keeps dots, dashes and underscores", () => {
    expect(sanitizeObjectName("my-file_v1.2.tar.gz")).toBe("my-file_v1.2.tar.gz");
  });

  it("falls back to a placeholder for an empty result", () => {
    expect(sanitizeObjectName("###")).toBe("file");
    expect(sanitizeObjectName("")).toBe("file");
  });
});
