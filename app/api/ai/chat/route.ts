import { GoogleGenAI, type Content, type Part } from "@google/genai";
import { createClient } from "@/lib/supabase/server";
import { ALL_TOOLS, APPROVAL_TOOL_NAMES } from "@/lib/ai/tools";
import { executeTool } from "@/lib/ai/execute-tool";
import {
  retrieveMemories,
  storeMemory,
  compactMessages,
  formatMemoriesForPrompt,
} from "@/lib/ai/memory";
import { format } from "date-fns";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Simple message type used by frontend (compatible with what we send over the wire)
export type MessageParam = {
  role: "user" | "assistant" | "model";
  content: string;
};

// ─── Request body schema ──────────────────────────────────────────────────────

const ChatRequestBody = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant", "model"]),
        content: z.string().max(100_000),
      }),
    )
    .max(200),
  approvalToken: z.string().optional(),
});

// ─── Approval token (HMAC-signed, 5-minute expiry) ────────────────────────────

interface ApprovalPayload {
  userId: string;
  toolName: string;
  input: Record<string, unknown>;
  exp: number;
}

function hmacSecret(): string {
  return process.env.APPROVAL_HMAC_SECRET ?? process.env.GEMINI_API_KEY ?? "";
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
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as ApprovalPayload;
    if (payload.userId !== userId) return null;
    if (Date.now() > payload.exp) return null;
    return { toolName: payload.toolName, input: payload.input };
  } catch {
    return null;
  }
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are RISE, an AI personal assistant integrated into the user's personal operating system.
You have access to their tasks, goals, finances (AED), habits, contacts, and notes.

Today's date: {TODAY}

Key rules:
- Be concise and action-oriented. Avoid filler.
- Always use AED for money amounts in UAE Dirham format.
- Use DD/MM/YYYY for dates when displaying to the user.
- When creating tasks from natural language, extract the due date intelligently (e.g. "tomorrow" → correct date).
- For approval-required tools (delete_task, bulk_complete_tasks, delete_note): always call the tool — the system will intercept it and ask the user for approval before executing.
- After using tools, report back clearly: what was created/updated/found.
- If the user asks "what should I do today?" — call get_daily_briefing first, then summarize.

{CONTEXT}`;

async function buildContext(
  userId: string,
  latestUserMessage: string,
): Promise<string> {
  const supabase = await createClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const dow = new Date().getDay();

  const [{ data: tasks }, { data: habits }, { data: goals }, memories] =
    await Promise.all([
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
      retrieveMemories(userId, latestUserMessage, 10),
    ]);

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
  return parts.join("\n");
}

/** Convert our simple MessageParam format to Gemini Content format */
function toGeminiHistory(messages: MessageParam[]): Content[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }] as Part[],
  }));
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const bodyParsed = ChatRequestBody.safeParse(await request.json());
  if (!bodyParsed.success)
    return new Response("Bad Request", { status: 400 });

  const { messages, approvalToken } = bodyParsed.data;

  // If user approved a pending tool, verify the signed token and execute
  if (approvalToken) {
    const verified = verifyApprovalToken(approvalToken, user.id);
    if (!verified)
      return new Response("Invalid or expired approval", { status: 403 });
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

  const context = await buildContext(user.id, latestText);
  const today = format(new Date(), "dd/MM/yyyy");
  const systemPrompt = SYSTEM_PROMPT.replace("{TODAY}", today).replace(
    "{CONTEXT}",
    context,
  );

  // Separate conversation history from the last user message
  const history = messages.slice(0, -1);
  const userInput = latestText;

  const encoder = new TextEncoder();

  function sseChunk(payload: Record<string, unknown>) {
    return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
  }

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const model = genai.chats.create({
          model: "gemini-2.5-flash",
          config: {
            systemInstruction: systemPrompt,
            tools: [{ functionDeclarations: ALL_TOOLS }],
          },
          history: toGeminiHistory(history),
        });

        // First turn: stream the response
        const stream = model.sendMessageStream({ message: userInput });

        let fullText = "";
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
              fullText += part.text;
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

        // Suppress unused var warning — fullText is accumulated for potential future use
        void fullText;

        // Process function calls
        if (functionCalls.length > 0) {
          const toolResultParts: Part[] = [];
          let hasApproval = false;

          for (const fc of functionCalls) {
            if (APPROVAL_TOOL_NAMES.has(fc.name)) {
              // Verify the referenced resource exists before presenting approval
              let resourceExists = true;
              if (fc.name === "delete_task" && typeof fc.args.task_id === "string") {
                const { data } = await supabase
                  .from("tasks")
                  .select("id")
                  .eq("id", fc.args.task_id)
                  .eq("user_id", user.id)
                  .maybeSingle();
                resourceExists = !!data;
              } else if (fc.name === "delete_note" && typeof fc.args.note_id === "string") {
                const { data } = await supabase
                  .from("notes")
                  .select("id")
                  .eq("id", fc.args.note_id)
                  .eq("user_id", user.id)
                  .maybeSingle();
                resourceExists = !!data;
              }

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
                exp: Date.now() + 5 * 60 * 1000,
              });

              hasApproval = true;
              controller.enqueue(
                sseChunk({
                  type: "approval_required",
                  tool: { id: fc.id, name: fc.name, input: fc.args },
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
        console.error("[ai/chat] streaming error:", err);
        controller.enqueue(
          sseChunk({ type: "error", message: "Something went wrong. Please try again." }),
        );
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
