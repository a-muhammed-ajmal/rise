/**
 * Carries what the assistant's tools returned into later turns.
 *
 * Gemini only sees the text of earlier messages, so without this a list the
 * assistant showed one turn ago is gone by the next: "delete the second one"
 * has no id to act on. Each tool result is reduced to a compact text summary
 * (ids and short fields), stored with the message on the client, and replayed
 * into history for the most recent turns.
 */

// Per tool result. A page of 20 narrow rows fits; wide rows are truncated.
export const MAX_TOOL_CONTEXT_CHARS = 1_500;
// Only the most recent assistant turns carry their tool results back. Older
// references are rare, and every replayed character costs tokens on each request.
export const TOOL_CONTEXT_TURNS = 5;

const MAX_ROWS = 25;
const MAX_FIELD_CHARS = 80;
// Columns that never help the model refer back to a record.
const DROPPED_KEYS = new Set([
  "user_id",
  "embedding",
  "created_at",
  "updated_at",
  "deleted_at",
]);

type Scalar = string | number | boolean | null;

function compactValue(value: unknown): Scalar | undefined {
  if (value === null) return null;
  if (typeof value === "string")
    return value.length > MAX_FIELD_CHARS
      ? `${value.slice(0, MAX_FIELD_CHARS)}…`
      : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  // Nested objects and arrays (subtasks, JSON content) are dropped: they are
  // rarely what a follow-up refers to, and they dominate the size.
  return undefined;
}

function compactRow(row: unknown): Record<string, Scalar> | Scalar | undefined {
  if (!row || typeof row !== "object" || Array.isArray(row))
    return compactValue(row);
  const out: Record<string, Scalar> = {};
  for (const [key, value] of Object.entries(row)) {
    if (DROPPED_KEYS.has(key)) continue;
    const compact = compactValue(value);
    if (compact !== undefined) out[key] = compact;
  }
  return out;
}

function compactData(data: unknown): unknown {
  if (Array.isArray(data)) {
    const rows = data.slice(0, MAX_ROWS).map(compactRow);
    return data.length > MAX_ROWS
      ? { rows, omitted: data.length - MAX_ROWS }
      : rows;
  }
  if (data && typeof data === "object") {
    // A single record (create_*, update_*) is compacted like a list row.
    if (Object.hasOwn(data, "id")) return compactRow(data);
    // Composite results ({ recipients, recent_failures }) keep one level.
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (DROPPED_KEYS.has(key)) continue;
      out[key] = Array.isArray(value) ? compactData(value) : compactRow(value);
    }
    return out;
  }
  return compactValue(data);
}

/**
 * One line of what a tool did, plus a compact copy of the rows it returned.
 * Failed calls keep only their message: there is nothing to refer back to.
 */
export function summarizeToolResult(
  tool: string,
  result: { success: boolean; message: string; data?: unknown },
): string {
  const head = `${tool} (${result.success ? "ok" : "failed"}): ${result.message}`;
  if (!result.success || result.data === undefined || result.data === null)
    return head.slice(0, MAX_TOOL_CONTEXT_CHARS);
  const body = JSON.stringify(compactData(result.data)) ?? "";
  const full = `${head}\n${body}`;
  return full.length > MAX_TOOL_CONTEXT_CHARS
    ? `${full.slice(0, MAX_TOOL_CONTEXT_CHARS)}…(truncated)`
    : full;
}

/**
 * Wraps a turn's tool summaries for replay into history. Like attachment text,
 * this is database content, never an instruction channel.
 */
export function buildToolHistoryContext(
  toolResults: readonly { context?: string }[] | undefined,
): string | null {
  const lines = (toolResults ?? [])
    .map((r) => r.context?.slice(0, MAX_TOOL_CONTEXT_CHARS))
    .filter((c): c is string => Boolean(c));
  if (lines.length === 0) return null;
  return `<untrusted-tool-results>\n${lines.join("\n")}\n</untrusted-tool-results>`;
}

/**
 * Indices of the messages whose tool results are replayed: the last
 * TOOL_CONTEXT_TURNS assistant messages that have any.
 */
export function toolContextIndices(
  messages: readonly { role: string; toolResults?: readonly { context?: string }[] }[],
): Set<number> {
  const picked = new Set<number>();
  for (let i = messages.length - 1; i >= 0; i--) {
    if (picked.size >= TOOL_CONTEXT_TURNS) break;
    const m = messages[i];
    const isModel = m.role === "assistant" || m.role === "model";
    if (isModel && m.toolResults?.some((r) => Boolean(r.context))) picked.add(i);
  }
  return picked;
}
