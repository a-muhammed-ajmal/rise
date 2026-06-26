import Anthropic from "@anthropic-ai/sdk";
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
import type { MessageParam } from "@anthropic-ai/sdk/resources/messages";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
  const latestText =
    typeof lastUserMsg?.content === "string"
      ? lastUserMsg.content
      : Array.isArray(lastUserMsg?.content)
        ? lastUserMsg.content
            .filter(
              (b): b is { type: "text"; text: string } => b.type === "text",
            )
            .map((b) => b.text)
            .join(" ")
        : "";

  // Store the user message as a memory (fire-and-forget)
  if (latestText) {
    storeMemory(user.id, latestText, {
      role: "user",
      turn_index: messages.length,
    }).catch(() => {});
  }

  // Compact old messages if conversation is long
  const plainMessages = messages
    .filter(
      (m): m is MessageParam & { content: string } =>
        typeof m.content === "string",
    )
    .map((m) => ({ role: m.role, content: m.content }));
  compactMessages(user.id, plainMessages).catch(() => {});

  const context = await buildContext(user.id, latestText);
  const today = format(new Date(), "dd/MM/yyyy");
  const systemPrompt = SYSTEM_PROMPT.replace("{TODAY}", today).replace(
    "{CONTEXT}",
    context,
  );

  const stream = await anthropic.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    tools: ALL_TOOLS,
    messages,
  });

  function sseChunk(payload: Record<string, unknown>) {
    return encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(
              sseChunk({ type: "text", text: event.delta.text }),
            );
          }
        }

        const message = await stream.finalMessage();

        // Process tool calls and collect results for the follow-up turn
        type ToolResultContent = {
          type: "tool_result";
          tool_use_id: string;
          content: string;
        };
        const toolResultContents: ToolResultContent[] = [];
        let hasApproval = false;

        for (const block of message.content) {
          if (block.type !== "tool_use") continue;

          const toolInput = block.input as Record<string, unknown>;

          if (APPROVAL_TOOL_NAMES.has(block.name)) {
            hasApproval = true;
            controller.enqueue(
              sseChunk({
                type: "approval_required",
                tool: { id: block.id, name: block.name, input: toolInput },
              }),
            );
            toolResultContents.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: "Awaiting user approval",
            });
            continue;
          }

          const result = await executeTool(block.name, toolInput);
          controller.enqueue(
            sseChunk({ type: "tool_result", tool: block.name, result }),
          );
          toolResultContents.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }

        // Follow-up turn: send tool results back to Claude for a natural-language reply
        if (toolResultContents.length > 0 && !hasApproval) {
          const followupMessages: MessageParam[] = [
            ...messages,
            { role: "assistant", content: message.content },
            { role: "user", content: toolResultContents },
          ];

          const followupStream = await anthropic.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 512,
            system: systemPrompt,
            tools: ALL_TOOLS,
            messages: followupMessages,
          });

          for await (const event of followupStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(
                sseChunk({ type: "text", text: event.delta.text }),
              );
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
