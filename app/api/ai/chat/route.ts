import { GoogleGenAI, type Content, type Part } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { ALL_TOOLS, APPROVAL_TOOL_NAMES } from "@/lib/ai/tools";
import { executeTool } from "@/lib/ai/execute-tool";
import {
  retrieveMemories,
  retrieveUserFacts,
  storeMemory,
  compactMessages,
  formatMemoriesForPrompt,
  formatUserFactsForPrompt,
} from "@/lib/ai/memory";
import type { ChatAttachment, Database } from "@/lib/types/database";
import { format, parseISO } from "date-fns";
import { todayISO, todayDOW } from "@/lib/format";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { evaluateFinancialGate, isMoneyTool } from "@/lib/ai/financial-safety";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { z } from "zod";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" });

// ─── Request body schema ──────────────────────────────────────────────────────

const AttachmentSchema = z.object({
  id: z.string().uuid(),
  storage_path: z.string().max(500),
  filename: z.string().max(255),
  mime_type: z.string().max(100),
  size_bytes: z.number().int().nonnegative(),
  category: z.enum(["image", "file", "audio"]),
  extracted_text: z.string().max(200_000).optional(),
  transcript: z.string().max(50_000).optional(),
});

const ChatRequestBody = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "model"]),
        content: z.string().max(100_000),
        attachments: z.array(AttachmentSchema).max(10).optional(),
      }),
    )
    .max(200),
  approvalToken: z.string().optional(),
});

// Simple message type used by frontend (compatible with what we send over the wire)
export type MessageParam = {
  role: "user" | "assistant" | "model";
  content: string;
  attachments?: ChatAttachment[];
};

// ─── Approval token (HMAC-signed, 5-minute expiry) ────────────────────────────

const APPROVAL_TTL_MS = 2 * 60 * 1000;

const ApprovalPayloadSchema = z.object({
  userId: z.string(),
  toolName: z.string(),
  input: z.record(z.string(), z.unknown()),
  exp: z.number(),
  jti: z.string(),
});
type ApprovalPayload = z.infer<typeof ApprovalPayloadSchema>;

// Single-use guard for approval tokens. In-process only, so it is a best-effort
// defence against double-submits and quick replays within one instance's
// lifetime — not a distributed guarantee. The short TTL is the real bound.
const spentApprovals = new Map<string, number>();

function consumeApprovalNonce(jti: string, exp: number): boolean {
  const now = Date.now();
  for (const [id, expiry] of spentApprovals) {
    if (expiry < now) spentApprovals.delete(id);
  }
  if (spentApprovals.has(jti)) return false;
  spentApprovals.set(jti, exp);
  return true;
}

function hmacSecret(): string {
  const s = process.env.APPROVAL_HMAC_SECRET;
  if (!s) throw new Error("APPROVAL_HMAC_SECRET env var is required");
  return s;
}

function signApprovalToken(payload: ApprovalPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", hmacSecret()).update(data).digest("base64url");
  return `${data}.${sig}`;
}

function verifyApprovalToken(
  token: string,
  userId: string,
): { toolName: string; input: Record<string, unknown> } | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const data = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    const expectedSigBuf = createHmac("sha256", hmacSecret()).update(data).digest();
    const actualSigBuf = Buffer.from(sig, "base64url");
    if (
      expectedSigBuf.length !== actualSigBuf.length ||
      !timingSafeEqual(expectedSigBuf, actualSigBuf)
    )
      return null;
    const payloadParsed = ApprovalPayloadSchema.safeParse(
      JSON.parse(Buffer.from(data, "base64url").toString()),
    );
    if (!payloadParsed.success) return null;
    const payload = payloadParsed.data;
    if (payload.userId !== userId) return null;
    if (Date.now() > payload.exp) return null;
    if (!consumeApprovalNonce(payload.jti, payload.exp)) return null;
    return { toolName: payload.toolName, input: payload.input };
  } catch {
    return null;
  }
}

// ─── Approval ownership preflight ─────────────────────────────────────────────

// Which table and argument identify the resource each approval tool acts on, so
// the confirmation prompt can never name a row the user does not own. One table
// drives one query instead of a per-tool if/else chain.
type ApprovalResource = {
  table: keyof Database["public"]["Tables"];
  idArg: string;
  label: string;
};

const APPROVAL_RESOURCES: Record<string, ApprovalResource> = {
  delete_task: { table: "tasks", idArg: "task_id", label: "Task" },
  delete_note: { table: "notes", idArg: "note_id", label: "Note" },
  delete_project: { table: "projects", idArg: "project_id", label: "Project" },
  delete_goal: { table: "goals", idArg: "goal_id", label: "Goal" },
  delete_milestone: { table: "milestones", idArg: "milestone_id", label: "Milestone" },
  delete_habit: { table: "habits", idArg: "habit_id", label: "Habit" },
  delete_habit_log: { table: "habits", idArg: "habit_id", label: "Habit" },
  delete_transaction: { table: "transactions", idArg: "transaction_id", label: "Transaction" },
  update_transaction: { table: "transactions", idArg: "transaction_id", label: "Transaction" },
  delete_budget: { table: "budgets", idArg: "budget_id", label: "Budget" },
  delete_debt: { table: "debts", idArg: "debt_id", label: "Debt" },
  update_debt: { table: "debts", idArg: "debt_id", label: "Debt" },
  delete_contact: { table: "contacts", idArg: "contact_id", label: "Contact" },
  delete_interaction: { table: "interactions", idArg: "interaction_id", label: "Interaction" },
  delete_document: { table: "documents", idArg: "document_id", label: "Document" },
  delete_journal_entry: { table: "journal_entries", idArg: "entry_id", label: "Journal entry" },
  delete_review: { table: "reviews", idArg: "review_id", label: "Review" },
  delete_link: { table: "links", idArg: "id", label: "Link" },
  delete_focus_session: { table: "focus_sessions", idArg: "id", label: "Focus session" },
};

async function countActivePaymentMethods(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<number> {
  const { count } = await supabase
    .from("payment_methods")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_active", true);
  return count ?? 0;
}

async function approvalResourceExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  toolName: string,
  args: Record<string, unknown>,
  userId: string,
): Promise<boolean> {
  const resource = APPROVAL_RESOURCES[toolName];
  if (!resource) return true; // e.g. bulk_complete_tasks — no single row to check
  const id = args[resource.idArg];
  if (typeof id !== "string") return true; // let the tool's own zod schema reject it
  const { data } = await supabase
    .from(resource.table)
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are RISE, the personal AI assistant of {NAME}.
You have full access to their tasks, goals, finances (AED), habits, contacts, notes, and journal.

Today's date: {TODAY}

{PROFILE}
Key rules:
- Be concise and action-oriented. Avoid filler.
- Address the user by name when it feels natural.
- Always use AED for money amounts in UAE Dirham format.
- Use DD/MM/YYYY for dates when displaying to the user.
- When creating tasks from natural language, extract the due date intelligently (e.g. "tomorrow" → correct date).
- For approval-required tools (delete_task, bulk_complete_tasks, delete_project, delete_goal, delete_milestone, delete_habit, delete_habit_log, update_transaction, delete_transaction, delete_budget, update_debt, delete_debt, delete_contact, delete_interaction, delete_note, delete_document, delete_journal_entry, delete_review, delete_link, delete_focus_session): always call the tool — the system will intercept it and ask the user for approval before executing.
- Logging money (log_expense, log_income) runs immediately for small, fully-specified amounts, but the system will ask the user to confirm large or ambiguous amounts. Always include a category, and call list_payment_methods first when the user has more than one wallet.
- When updating or deleting by name (e.g. "delete my dentist contact"), always call the relevant list_* or search_data tool first to resolve the name to an id. Never guess an id.
- After using tools, report back clearly: what was created/updated/found.
- If the user asks "what should I do today?" — call get_daily_briefing first, then summarize.
- When the user tells you something personal (name, job, location, preferences, family, habits) — call remember_user_fact() to save it for future conversations.
- When the user references something from a past conversation, call recall_memories() to look it up before answering.

{CONTEXT}`;

type BuildContextResult = {
  context: string;
  profileContext: string;
  userName: string;
};

async function buildContext(
  userId: string,
  latestUserMessage: string,
): Promise<BuildContextResult> {
  const supabase = await createClient();
  const today = todayISO();
  const dow = todayDOW();

  const [
    { data: tasks },
    { data: habits },
    { data: goals },
    { data: profile },
    memories,
    userFacts,
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("title, priority, due_date, status")
      .neq("status", "done")
      .or(`due_date.eq.${today},status.eq.inbox`)
      .limit(10),
    supabase
      .from("habits")
      .select("id, name")
      .eq("active", true)
      .contains("target_days", [dow]),
    supabase
      .from("goals")
      .select("title, progress")
      .eq("status", "active")
      .limit(5),
    supabase
      .from("user_profile")
      .select("display_name, occupation, location, bio, facts")
      .eq("user_id", userId)
      .maybeSingle(),
    retrieveMemories(userId, latestUserMessage, 8),
    retrieveUserFacts(userId),
  ]);

  // ── Profile context ──────────────────────────────────────────────────────
  const userName = profile?.display_name ?? "the user";
  const profileLines: string[] = [];
  if (profile?.occupation) profileLines.push(`Occupation: ${profile.occupation}`);
  if (profile?.location) profileLines.push(`Location: ${profile.location}`);
  if (profile?.bio) profileLines.push(`About: ${profile.bio}`);
  const facts = profile?.facts as Record<string, string> | null;
  if (facts && Object.keys(facts).length > 0) {
    const factLines = Object.entries(facts)
      .slice(0, 20)
      .map(([k, v]) => `  • ${k}: ${v}`)
      .join("\n");
    profileLines.push(`Known facts:\n${factLines}`);
  }
  const userFactContext = formatUserFactsForPrompt(userFacts);
  if (userFactContext) profileLines.push(userFactContext);

  const profileContext = profileLines.length
    ? `About ${userName}:\n${profileLines.join("\n")}\n`
    : "";

  // ── Live data context ────────────────────────────────────────────────────
  const lines: string[] = [];
  if (tasks?.length)
    lines.push(
      `Today's tasks (${tasks.length}): ${tasks.map((t) => `"${t.title}" [${t.priority}]`).join(", ")}`,
    );
  if (habits?.length)
    lines.push(`Habits due today: ${habits.map((h) => h.name).join(", ")}`);
  if (goals?.length)
    lines.push(
      `Active goals: ${goals.map((g) => `"${g.title}" (${g.progress}%)`).join(", ")}`,
    );

  const memoryContext = formatMemoriesForPrompt(memories);

  const parts: string[] = [];
  if (lines.length) parts.push(`\nCurrent context:\n${lines.join("\n")}`);
  if (memoryContext) parts.push(memoryContext);

  return { context: parts.join("\n"), profileContext, userName };
}

// ─── Gemini parts builder ─────────────────────────────────────────────────────

/**
 * Builds a Gemini Part[] for a single message.
 * For the current (last) user message, images are included as inlineData.
 * For historical messages, images are represented as text placeholders to
 * avoid re-downloading binaries on every request.
 */
function buildGeminiParts(
  content: string,
  attachments: ChatAttachment[] | undefined,
  imageData: Map<string, { base64: string; mimeType: string }>,
  isCurrentMessage: boolean,
): Part[] {
  const parts: Part[] = [];

  // Inject file/audio text as context prefix before the user's own words
  const contextLines: string[] = [];
  for (const att of attachments ?? []) {
    if (att.category === "file" && att.extracted_text) {
      contextLines.push(
        `[Attached file: ${att.filename}]\n${att.extracted_text}`,
      );
    }
    if (att.category === "audio" && att.transcript) {
      contextLines.push(`[Voice message transcript]: ${att.transcript}`);
    }
  }
  if (contextLines.length) {
    parts.push({ text: contextLines.join("\n\n") });
  }

  // Main message text
  if (content.trim()) {
    parts.push({ text: content });
  }

  // Images
  for (const att of attachments ?? []) {
    if (att.category !== "image") continue;

    const data = imageData.get(att.storage_path);
    if (isCurrentMessage && data) {
      parts.push({ inlineData: { data: data.base64, mimeType: data.mimeType } });
    } else {
      // Historical message or image failed to download — use placeholder
      parts.push({ text: `[Attached image: ${att.filename}]` });
    }
  }

  // Gemini rejects an empty parts array
  if (parts.length === 0) {
    parts.push({ text: "" });
  }

  return parts;
}

/** Convert our MessageParam format to Gemini Content format */
async function toGeminiHistory(messages: MessageParam[]): Promise<Content[]> {
  // History messages never get image inlineData (empty map) to avoid
  // re-downloading binaries on every request.
  const emptyImageData = new Map<string, { base64: string; mimeType: string }>();
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : ("user" as const),
    parts: buildGeminiParts(m.content, m.attachments, emptyImageData, false),
  }));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Caps Gemini spend per user. Applied after auth so the key is a real user id.
  const rl = checkRateLimit(`chat:${user.id}`, { limit: 20, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  const bodyParsed = ChatRequestBody.safeParse(await request.json().catch(() => null));
  if (!bodyParsed.success)
    return new Response("Bad Request", { status: 400 });

  const { messages, approvalToken } = bodyParsed.data;

  // If user approved a pending tool, verify the signed token and execute
  if (approvalToken) {
    const verified = verifyApprovalToken(approvalToken, user.id);
    if (!verified)
      return new Response("Invalid or expired approval", { status: 403 });
    // Money tools are AUTO-tier but reach this path via the financial gate.
    if (
      !APPROVAL_TOOL_NAMES.has(verified.toolName) &&
      !isMoneyTool(verified.toolName)
    )
      return new Response("Forbidden", { status: 403 });
    const result = await executeTool(verified.toolName, verified.input);
    return Response.json({ type: "tool_result", result });
  }

  // Extract latest user message for memory retrieval
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const latestText = lastUserMsg?.content ?? "";

  // Store the user message as a memory (fire-and-forget)
  if (latestText) {
    storeMemory(user.id, latestText, {
      role: "user",
      turn_index: messages.length,
    }).catch(() => {});
  }

  // Compact old messages if conversation is long
  const plainMessages = messages
    .filter((m) => typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content }));
  compactMessages(user.id, plainMessages).catch(() => {});

  const { context, profileContext, userName } = await buildContext(user.id, latestText);
  const today = format(parseISO(todayISO()), "dd/MM/yyyy");
  const systemPrompt = SYSTEM_PROMPT
    .replace("{TODAY}", today)
    .replace("{NAME}", userName)
    .replace("{PROFILE}", profileContext)
    .replace("{CONTEXT}", context);

  // Separate conversation history from the last user message
  const history = messages.slice(0, -1);
  const currentMsg = messages[messages.length - 1];
  const userInput = latestText;

  // ── Download images for the current message ──────────────────────────────
  const imageData = new Map<string, { base64: string; mimeType: string }>();
  if (currentMsg?.attachments?.length) {
    await Promise.all(
      currentMsg.attachments
        .filter((a) => a.category === "image")
        .map(async (att) => {
          try {
            const { data, error } = await supabase.storage
              .from("chat-attachments")
              .download(att.storage_path);
            if (error || !data) return;
            const ab = await data.arrayBuffer();
            imageData.set(att.storage_path, {
              base64: Buffer.from(ab).toString("base64"),
              mimeType: att.mime_type,
            });
          } catch {
            // Silently skip — partial image failures degrade gracefully
          }
        }),
    );
  }

  const encoder = new TextEncoder();
  // Correlates the generic client-facing error with the full server-side log.
  const requestId = randomUUID();

  function sseChunk(payload: Record<string, unknown>) {
    return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
  }

  const readable = new ReadableStream({
    async start(controller) {
      try {
        if (!process.env.GEMINI_API_KEY) {
          throw new Error("GEMINI_API_KEY is not configured");
        }
        const model = genai.chats.create({
          model: "gemini-2.5-flash",
          config: {
            systemInstruction: systemPrompt,
            tools: [{ functionDeclarations: ALL_TOOLS }],
            thinkingConfig: { thinkingBudget: 0 },
          },
          history: await toGeminiHistory(history),
        });

        // Build parts for the current user message (with image inlineData)
        const currentParts = buildGeminiParts(
          userInput,
          currentMsg?.attachments,
          imageData,
          true,
        );

        // First turn: stream the response
        const stream = model.sendMessageStream({ message: currentParts });

        const functionCalls: Array<{
          id: string;
          name: string;
          args: Record<string, unknown>;
        }> = [];

        for await (const chunk of await stream) {
          const candidate = chunk.candidates?.[0];
          if (!candidate) continue;

          for (const part of candidate.content?.parts ?? []) {
            if (part.text) {
              controller.enqueue(sseChunk({ type: "text", text: part.text }));
            }
            if (part.functionCall) {
              functionCalls.push({
                id: part.functionCall.id ?? crypto.randomUUID(),
                name: part.functionCall.name ?? "",
                args: (part.functionCall.args ?? {}) as Record<string, unknown>,
              });
            }
          }
        }

        // Process function calls
        if (functionCalls.length > 0) {
          const toolResultParts: Part[] = [];
          let hasApproval = false;

          for (const fc of functionCalls) {
            // Money writes stay AUTO for small, fully-specified amounts but
            // escalate to the same signed-approval flow when the figure is
            // material or the payload is ambiguous.
            let financialGateSummary: string | undefined;
            if (isMoneyTool(fc.name)) {
              const decision = evaluateFinancialGate(
                fc.name,
                fc.args,
                await countActivePaymentMethods(supabase, user.id),
              );
              if (decision.requiresApproval)
                financialGateSummary = decision.summary;
            }

            if (APPROVAL_TOOL_NAMES.has(fc.name) || financialGateSummary) {
              // Never show a confirmation naming a row the user does not own.
              const resourceExists = await approvalResourceExists(
                supabase,
                fc.name,
                fc.args,
                user.id,
              );

              if (!resourceExists) {
                toolResultParts.push({
                  functionResponse: {
                    id: fc.id,
                    name: fc.name,
                    response: { result: "Resource not found" },
                  },
                });
                continue;
              }

              // Sign the approval so the client can't tamper with tool name or input
              const token = signApprovalToken({
                userId: user.id,
                toolName: fc.name,
                input: fc.args,
                exp: Date.now() + APPROVAL_TTL_MS,
                jti: randomUUID(),
              });

              hasApproval = true;
              controller.enqueue(
                sseChunk({
                  type: "approval_required",
                  tool: { id: fc.id, name: fc.name, input: fc.args },
                  reason: financialGateSummary,
                  token,
                }),
              );
              toolResultParts.push({
                functionResponse: {
                  id: fc.id,
                  name: fc.name,
                  response: { result: "Awaiting user approval" },
                },
              });
              continue;
            }

            const result = await executeTool(fc.name, fc.args);
            controller.enqueue(
              sseChunk({ type: "tool_result", tool: fc.name, result }),
            );
            toolResultParts.push({
              functionResponse: {
                id: fc.id,
                name: fc.name,
                response: { result: JSON.stringify(result) },
              },
            });
          }

          // Follow-up turn: send tool results back for a natural-language reply
          if (!hasApproval) {
            const followupStream = model.sendMessageStream({
              message: toolResultParts,
            });

            for await (const chunk of await followupStream) {
              const candidate = chunk.candidates?.[0];
              if (!candidate) continue;
              for (const part of candidate.content?.parts ?? []) {
                if (part.text) {
                  controller.enqueue(
                    sseChunk({ type: "text", text: part.text }),
                  );
                }
              }
            }
          }
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        // The raw error can carry Gemini/Supabase internals and env-var names.
        // Log it server-side against a correlation id; return a stable message.
        console.error(`[ai/chat] ${requestId} streaming error:`, err);
        try {
          controller.enqueue(
            sseChunk({
              type: "error",
              message: "AI request failed. Please try again.",
              requestId,
            }),
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch {
          // Controller already closed (client disconnected) — nothing to send.
        }
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
