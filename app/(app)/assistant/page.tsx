"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  Send,
  AlertTriangle,
  CheckCircle,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
type MessageParam = { role: "user" | "assistant" | "model"; content: string };

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolResults?: { tool: string; message: string; success: boolean }[];
};

type PendingApproval = {
  tool: { id: string; name: string; input: Record<string, unknown> };
  token: string;
};

const TOOL_LABELS: Record<string, string> = {
  delete_task: "Delete task",
  bulk_complete_tasks: "Complete multiple tasks",
  delete_note: "Delete note",
};

function AssistantContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialQ ?? "");
  const [loading, setLoading] = useState(false);
  const [pendingApproval, setPendingApproval] =
    useState<PendingApproval | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-send if query param provided
  useEffect(() => {
    if (initialQ) {
      void sendMessage(initialQ);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendMessage(userText: string) {
    if (!userText.trim() || loading) return;
    setInput("");
    setLoading(true);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userText,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    const apiMessages: MessageParam[] = newMessages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const assistantId = crypto.randomUUID();
    let assistantText = "";
    const toolResults: Message["toolResults"] = [];

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6);
          if (raw === "[DONE]") continue;

          const event = JSON.parse(raw);

          if (event.type === "text") {
            assistantText += event.text;
            setMessages((prev) => {
              const updated = [...prev];
              const idx = updated.findIndex((m) => m.id === assistantId);
              if (idx >= 0) {
                updated[idx] = { ...updated[idx], content: assistantText };
              } else {
                updated.push({
                  id: assistantId,
                  role: "assistant",
                  content: assistantText,
                  toolResults: [],
                });
              }
              return updated;
            });
          }

          if (event.type === "tool_result") {
            toolResults.push({
              tool: event.tool,
              message: event.result.message,
              success: event.result.success,
            });
            setMessages((prev) => {
              const updated = [...prev];
              const idx = updated.findIndex((m) => m.id === assistantId);
              if (idx >= 0) {
                updated[idx] = {
                  ...updated[idx],
                  toolResults: [...toolResults],
                };
              } else {
                // Claude used a tool without generating text first — create the message now
                updated.push({
                  id: assistantId,
                  role: "assistant",
                  content: "",
                  toolResults: [...toolResults],
                });
              }
              return updated;
            });
          }

          if (event.type === "error") {
            setMessages((prev) => [
              ...prev,
              {
                id: assistantId,
                role: "assistant",
                content: "Sorry, something went wrong. Please try again.",
              },
            ]);
          }

          if (event.type === "approval_required") {
            setPendingApproval({ tool: event.tool, token: event.token as string });
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content: "Sorry, something went wrong. Please try again.",
        },
      ]);
    }

    setLoading(false);
  }

  async function handleApprove() {
    if (!pendingApproval) return;
    setPendingApproval(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [],
          approvalToken: pendingApproval.token,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.result.message,
          toolResults: [
            {
              tool: pendingApproval.tool.name,
              message: data.result.message,
              success: data.result.success,
            },
          ],
        },
      ]);
    } catch {
      // ignore
    }
    setLoading(false);
  }

  const QUICK_PROMPTS = [
    "What should I focus on today?",
    "Show my daily briefing",
    "How are my goals progressing?",
    "Log AED 30 expense for lunch",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-4rem)] max-w-2xl mx-auto">
      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full space-y-4 py-12 animate-rise-in">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md">
              <Image
                src="/icon-512.png"
                alt="RISE"
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-center space-y-1">
              <h2 className="font-semibold text-lg">RISE AI Assistant</h2>
              <p className="text-sm text-muted-foreground">
                Ask me anything. I can read and act on all your data.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => void sendMessage(p)}
                  className="glass-ai card-interactive tappable text-left text-sm px-3 py-2.5 rounded-xl"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] space-y-2",
                    msg.role === "user" ? "items-end" : "items-start",
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-mod-ai" />
                      <span className="text-xs font-medium text-mod-ai">
                        RISE
                      </span>
                    </div>
                  )}
                  {msg.content && (
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "glass-ai text-foreground rounded-bl-sm",
                      )}
                    >
                      {msg.content}
                    </div>
                  )}
                  {msg.toolResults && msg.toolResults.length > 0 && (
                    <div className="space-y-1">
                      {msg.toolResults.map((r, i) => (
                        <div
                          key={i}
                          className={cn(
                            "flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg",
                            r.success
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
                          )}
                        >
                          {r.success ? (
                            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          ) : (
                            <X className="w-3.5 h-3.5 shrink-0" />
                          )}
                          {r.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading &&
              !messages.find(
                (m) =>
                  m.role === "assistant" &&
                  messages.indexOf(m) === messages.length - 1,
              ) && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Sparkles className="w-3.5 h-3.5 text-mod-ai" />
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="text-xs">Thinking…</span>
                </div>
              )}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Approval banner */}
      {pendingApproval && (
        <div className="mx-4 mb-2 p-3 rounded-xl border border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
                {TOOL_LABELS[pendingApproval.tool.name] ??
                  pendingApproval.tool.name}{" "}
                — confirmation required
              </p>
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                {JSON.stringify(pendingApproval.tool.input)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleApprove}
              className="bg-orange-500 hover:bg-orange-600"
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPendingApproval(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className={cn("p-4 border-t border-border transition-all", loading ? "ai-input-active" : "bg-background")}>
        <div className="flex gap-2 items-end">
          <Textarea
            ref={textareaRef}
            placeholder="Ask RISE anything…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage(input);
              }
            }}
            rows={1}
            className="resize-none min-h-[44px] max-h-[120px]"
            style={{ height: "auto" }}
          />
          <Button
            onClick={() => void sendMessage(input)}
            disabled={loading || !input.trim()}
            size="icon"
            className="shrink-0 h-11 w-11"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

export default function AssistantPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      }
    >
      <AssistantContent />
    </Suspense>
  );
}
