import type { ChatAttachment } from "@/lib/types/database";
import { isReadOnlyMcpToolName } from "@/lib/ai/mcp-schema";

export const MAX_TOOL_CALLS_PER_TURN = 8;
export const MAX_ATTACHMENT_CONTEXT_CHARS = 60_000;

type AttachmentText = Pick<
  ChatAttachment,
  "category" | "filename" | "extracted_text" | "transcript"
>;

/**
 * Attachment text is reference material, never an instruction channel. The
 * system prompt carries the trust rule; these explicit boundaries reinforce it
 * and the aggregate cap prevents a group of individually-valid files from
 * consuming the model context window.
 */
export function buildUntrustedAttachmentContext(
  attachments: readonly AttachmentText[],
): string | null {
  const blocks: string[] = [];
  let remaining = MAX_ATTACHMENT_CONTEXT_CHARS;

  for (const attachment of attachments) {
    const source =
      attachment.category === "file"
        ? attachment.extracted_text
        : attachment.category === "audio"
          ? attachment.transcript
          : undefined;
    if (!source || remaining <= 0) continue;

    const text = source.slice(0, remaining);
    remaining -= text.length;
    const label = attachment.filename.replace(/[\r\n<>]/g, " ").slice(0, 255);
    blocks.push(
      `<untrusted-attachment filename="${label}">\n${text}\n</untrusted-attachment>`,
    );
  }

  return blocks.length > 0 ? blocks.join("\n\n") : null;
}

/** Any write inferred from a file, image, or transcript requires confirmation. */
export function requiresAttachmentApproval(
  toolName: string,
  hasAttachmentContext: boolean,
): boolean {
  return hasAttachmentContext && !isReadOnlyMcpToolName(toolName);
}

export function isWithinToolCallBudget(callCount: number): boolean {
  return callCount <= MAX_TOOL_CALLS_PER_TURN;
}
