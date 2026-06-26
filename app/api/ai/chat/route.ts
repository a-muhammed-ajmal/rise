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

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Simple message type used by frontend (compatible with what we send over the wire)
export type MessageParam = {
  role: "user" | "assistant" | "model";
  content: string;
};

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

  const { messages, approvedTool } = (await request.json()) as {
    messages: MessageParam[];
    approvedTool?: { name: string; input: Record<string, unknown> };
  };

  // If user approved a pending tool, execute it and return the result
  if (approvedTool) {
    const result = await executeTool(approvedTool.name, approvedTool.input);
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

        // Process function calls
        if (functionCalls.length > 0) {
          const toolResultParts: Part[] = [];
          let hasApproval = false;

          for (const fc of functionCalls) {
            if (APPROVAL_TOOL_NAMES.has(fc.name)) {
              hasApproval = true;
              controller.enqueue(
                sseChunk({
                  type: "approval_required",
                  tool: { id: fc.id, name: fc.name, input: fc.args },
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
        const message = err instanceof Error ? err.message : "AI error";
        controller.enqueue(sseChunk({ type: "error", message }));
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
