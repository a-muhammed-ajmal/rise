import type { ChatAttachment } from "@/lib/types/database";
import { isReadOnlyMcpToolName } from "@/lib/ai/mcp-schema";

export const MAX_TOOL_CALLS_PER_TURN = 8;
// One user message may take several model turns: look a record up, act on it,
// then reply. Each round is a separate Gemini request, so the cap bounds both
// runaway loops and free-tier quota per message.
export const MAX_TOOL_ROUNDS = 4;
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

/**
 * Whether another round of tool calls may run for the same user message.
 * `roundsCompleted` counts rounds already executed; `totalCalls` includes the
 * round being considered, so the 8-call budget spans the whole message rather
 * than resetting on every round.
 */
export function canRunToolRound(
  roundsCompleted: number,
  totalCalls: number,
): boolean {
  return (
    roundsCompleted < MAX_TOOL_ROUNDS && isWithinToolCallBudget(totalCalls)
  );
}
