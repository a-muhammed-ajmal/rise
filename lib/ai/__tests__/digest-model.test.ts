import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.hoisted(() => vi.fn());

// Mocks must be hoisted before the module under test is imported.
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(function (
    this: Record<string, unknown>,
  ) {
    this.messages = { create: mockCreate };
  }),
}));

import { generateDigestWithClaude, DIGEST_UNAVAILABLE } from "../digest-model";

function reply(overrides: Record<string, unknown> = {}) {
  return {
    stop_reason: "end_turn",
    stop_details: null,
    content: [{ type: "text", text: "## Daily Digest" }],
    ...overrides,
  };
}

describe("generateDigestWithClaude", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the joined text of every text block", async () => {
    mockCreate.mockResolvedValue(
      reply({
        content: [
          { type: "text", text: "## Wins\n" },
          { type: "text", text: "Shipped the digest." },
        ],
      }),
    );

    const result = await generateDigestWithClaude("prompt");

    expect(result).toBe("## Wins\nShipped the digest.");
  });

  it("requests Claude Opus 5 with adaptive thinking at medium effort", async () => {
    mockCreate.mockResolvedValue(reply());

    await generateDigestWithClaude("summarise my day");

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-opus-5",
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        messages: [{ role: "user", content: "summarise my day" }],
      }),
    );
  });

  it("ignores non-text blocks such as thinking", async () => {
    mockCreate.mockResolvedValue(
      reply({
        content: [
          { type: "thinking", thinking: "internal reasoning" },
          { type: "text", text: "Visible digest." },
        ],
      }),
    );

    const result = await generateDigestWithClaude("prompt");

    expect(result).toBe("Visible digest.");
    expect(result).not.toContain("internal reasoning");
  });

  it("falls back when the model refuses", async () => {
    // A refusal is HTTP 200 with stop_reason "refusal" — it does not throw, so
    // reading content without checking would write an empty note.
    mockCreate.mockResolvedValue(
      reply({
        stop_reason: "refusal",
        stop_details: { type: "refusal", category: "cyber" },
        content: [],
      }),
    );

    const result = await generateDigestWithClaude("prompt");

    expect(result).toBe(DIGEST_UNAVAILABLE);
  });

  it("survives a refusal with no stop_details", async () => {
    mockCreate.mockResolvedValue(
      reply({ stop_reason: "refusal", stop_details: null, content: [] }),
    );

    await expect(generateDigestWithClaude("prompt")).resolves.toBe(
      DIGEST_UNAVAILABLE,
    );
  });

  it("falls back when the response carries no text", async () => {
    mockCreate.mockResolvedValue(reply({ content: [] }));

    const result = await generateDigestWithClaude("prompt");

    expect(result).toBe(DIGEST_UNAVAILABLE);
  });

  it("falls back when the text is only whitespace", async () => {
    mockCreate.mockResolvedValue(
      reply({ content: [{ type: "text", text: "   \n  " }] }),
    );

    const result = await generateDigestWithClaude("prompt");

    expect(result).toBe(DIGEST_UNAVAILABLE);
  });

  it("propagates API errors to the caller", async () => {
    // The digest route already logs and returns 500; swallowing here would
    // write a note claiming the day had no data.
    mockCreate.mockRejectedValue(new Error("rate limited"));

    await expect(generateDigestWithClaude("prompt")).rejects.toThrow(
      "rate limited",
    );
  });
});
