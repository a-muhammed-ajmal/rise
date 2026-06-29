"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AttachmentChip } from "@/components/assistant/attachment-chip";
import { AudioRecorder } from "@/components/assistant/audio-recorder";
import type { AttachmentStatus } from "@/components/assistant/attachment-chip";
import type { ChatAttachment } from "@/lib/types/database";
import {
  Sparkles,
  Send,
  AlertTriangle,
  CheckCircle,
  X,
  Loader2,
  Paperclip,
  Mic,
  FileText,
  Music,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────

type MessageParam = {
  role: "user" | "assistant" | "model";
  content: string;
  attachments?: ChatAttachment[];
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolResults?: { tool: string; message: string; success: boolean }[];
  attachments?: ChatAttachment[];
};

type PendingApproval = {
  tool: { id: string; name: string; input: Record<string, unknown> };
  token: string;
};

type PendingAttachment = {
  id: string;
  file: File;
  status: AttachmentStatus;
  progress: number;
  errorMessage?: string;
  previewUrl?: string;
  result?: ChatAttachment;
};

// ─── Constants ──────────────────────────────────────────────────────────────

const TOOL_LABELS: Record<string, string> = {
  delete_task: "Delete task",
  bulk_complete_tasks: "Complete multiple tasks",
  delete_project: "Delete project",
  delete_goal: "Delete goal",
  delete_milestone: "Delete milestone",
  delete_habit: "Delete habit",
  update_transaction: "Update transaction",
  delete_transaction: "Delete transaction",
  delete_budget: "Delete budget",
  update_debt: "Update debt record",
  delete_debt: "Delete debt record",
  delete_contact: "Delete contact",
  delete_interaction: "Delete interaction",
  delete_note: "Delete note",
  delete_document: "Delete document",
  delete_journal_entry: "Delete journal entry",
  delete_review: "Delete review",
};

const ACCEPTED_TYPES =
  ".jpg,.jpeg,.png,.webp,.heic,.pdf,.doc,.docx,.csv,.xlsx";

// ─── Attachment helpers ──────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Message attachment display ──────────────────────────────────────────────

function MessageAttachments({ attachments }: { attachments: ChatAttachment[] }) {
  const supabase = createClient();

  if (!attachments.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {attachments.map((att) => {
        if (att.category === "image") {
          return (
            <ImageAttachmentView
              key={att.id}
              att={att}
              supabase={supabase}
            />
          );
        }
        if (att.category === "audio") {
          return (
            <AudioAttachmentView
              key={att.id}
              att={att}
              supabase={supabase}
            />
          );
        }
        // file
        return (
          <FileAttachmentView
            key={att.id}
            att={att}
            supabase={supabase}
          />
        );
      })}
    </div>
  );
}

function ImageAttachmentView({
  att,
  supabase,
}: {
  att: ChatAttachment;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.storage
      .from("chat-attachments")
      .createSignedUrl(att.storage_path, 3600)
      .then(({ data }: { data: { signedUrl: string } | null }) => {
        if (data?.signedUrl) setUrl(data.signedUrl);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [att.storage_path]);

  return (
    <div className="rounded-lg overflow-hidden border border-border">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={att.filename}
          className="max-w-[200px] max-h-[200px] object-cover"
        />
      ) : (
        <div className="w-16 h-16 bg-muted flex items-center justify-center rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function FileAttachmentView({
  att,
  supabase,
}: {
  att: ChatAttachment;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.storage
      .from("chat-attachments")
      .createSignedUrl(att.storage_path, 3600)
      .then(({ data }: { data: { signedUrl: string } | null }) => {
        if (data?.signedUrl) setUrl(data.signedUrl);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [att.storage_path]);

  return (
    <a
      href={url ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-lg glass-ai text-xs hover:opacity-80 transition-opacity"
    >
      <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
      <span className="truncate max-w-[140px]">{att.filename}</span>
      <span className="text-muted-foreground shrink-0">
        {formatBytes(att.size_bytes)}
      </span>
    </a>
  );
}

function AudioAttachmentView({
  att,
  supabase,
}: {
  att: ChatAttachment;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [showTranscript, setShowTranscript] = useState(false);

  useEffect(() => {
    supabase.storage
      .from("chat-attachments")
      .createSignedUrl(att.storage_path, 3600)
      .then(({ data }: { data: { signedUrl: string } | null }) => {
        if (data?.signedUrl) setUrl(data.signedUrl);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [att.storage_path]);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg glass-ai text-xs">
        <Music className="w-4 h-4 shrink-0 text-mod-ai" />
        {url ? (
          <audio controls className="h-8 flex-1" title={att.filename}>
            <source src={url} type={att.mime_type} />
          </audio>
        ) : (
          <span className="text-muted-foreground">{att.filename}</span>
        )}
      </div>
      {att.transcript && (
        <div className="px-3">
          <button
            type="button"
            onClick={() => setShowTranscript((v) => !v)}
            className="text-xs text-mod-ai hover:underline"
          >
            {showTranscript ? "Hide transcript" : "Show transcript"}
          </button>
          {showTranscript && (
            <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">
              {att.transcript}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

function AssistantContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get("q");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState(initialQ ?? "");
  const [loading, setLoading] = useState(false);
  const [pendingApproval, setPendingApproval] =
    useState<PendingApproval | null>(null);

  // Attachment state
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // ── File upload ────────────────────────────────────────────────────────────

  async function uploadFile(file: File, pendingId: string) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("session_id", sessionId);

    try {
      const res = await fetch("/api/ai/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        setPendingAttachments((prev) =>
          prev.map((a) =>
            a.id === pendingId
              ? { ...a, status: "error", errorMessage: errText }
              : a,
          ),
        );
        return;
      }

      const result = (await res.json()) as Omit<ChatAttachment, "id">;
      setPendingAttachments((prev) =>
        prev.map((a) =>
          a.id === pendingId
            ? {
                ...a,
                status: "done",
                progress: 100,
                result: { ...result, id: pendingId },
              }
            : a,
        ),
      );
    } catch {
      setPendingAttachments((prev) =>
        prev.map((a) =>
          a.id === pendingId
            ? {
                ...a,
                status: "error",
                errorMessage: "Upload failed. Please try again.",
              }
            : a,
        ),
      );
    }
  }

  function handleFilesSelected(files: FileList) {
    const newPending: PendingAttachment[] = Array.from(files).map((file) => {
      const id = crypto.randomUUID();
      const previewUrl =
        file.type.startsWith("image/")
          ? URL.createObjectURL(file)
          : undefined;
      return { id, file, status: "uploading", progress: 0, previewUrl };
    });

    setPendingAttachments((prev) => [...prev, ...newPending]);

    // Start uploads
    for (const pending of newPending) {
      void uploadFile(pending.file, pending.id);
    }
  }

  function handleAudioComplete(blob: Blob, mimeType: string) {
    setShowAudioRecorder(false);
    const id = crypto.randomUUID();
    const file = new File([blob], `recording-${Date.now()}.webm`, {
      type: mimeType,
    });
    setPendingAttachments((prev) => [
      ...prev,
      { id, file, status: "uploading", progress: 0 },
    ]);
    void uploadFile(file, id);
  }

  function removeAttachment(id: string) {
    setPendingAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }

  // ── Send message ───────────────────────────────────────────────────────────

  async function sendMessage(userText: string) {
    const readyAttachments = pendingAttachments
      .filter((a) => a.status === "done" && a.result)
      .map((a) => a.result!);

    const hasContent = userText.trim() || readyAttachments.length > 0;
    if (!hasContent || loading) return;

    setInput("");
    setPendingAttachments([]);
    setLoading(true);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: userText,
      attachments: readyAttachments.length ? readyAttachments : undefined,
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);

    const apiMessages: MessageParam[] = newMessages.map((m) => ({
      role: m.role,
      content: m.content,
      attachments: m.attachments,
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

  const isUploading = pendingAttachments.some((a) => a.status === "uploading");
  const hasReadyContent =
    input.trim() ||
    pendingAttachments.some((a) => a.status === "done");

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
                  {/* Attachments in message bubbles */}
                  {msg.attachments && msg.attachments.length > 0 && (
                    <MessageAttachments attachments={msg.attachments} />
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

      {/* Input area */}
      <div
        className={cn(
          "p-4 border-t border-border transition-all",
          loading ? "ai-input-active" : "bg-background",
        )}
      >
        {/* Audio recorder (inline, above chips) */}
        {showAudioRecorder && (
          <div className="mb-2">
            <AudioRecorder
              onRecordingComplete={handleAudioComplete}
              onCancel={() => setShowAudioRecorder(false)}
            />
          </div>
        )}

        {/* Pending attachment chips */}
        {pendingAttachments.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {pendingAttachments.map((a) => (
              <AttachmentChip
                key={a.id}
                id={a.id}
                filename={a.file.name}
                size_bytes={a.file.size}
                category={
                  a.file.type.startsWith("image/")
                    ? "image"
                    : a.file.type.startsWith("audio/")
                      ? "audio"
                      : "file"
                }
                mime_type={a.file.type}
                status={a.status}
                progress={a.progress}
                errorMessage={a.errorMessage}
                previewUrl={a.previewUrl}
                onRemove={removeAttachment}
              />
            ))}
          </div>
        )}

        {/* Input row */}
        <div className="flex gap-2 items-end">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={ACCEPTED_TYPES}
            multiple
            onChange={(e) => {
              if (e.target.files?.length) {
                handleFilesSelected(e.target.files);
                e.target.value = "";
              }
            }}
          />

          {/* Paperclip button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Attach file"
            disabled={loading}
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 h-11 w-11 text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="w-4 h-4" />
          </Button>

          {/* Mic button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={showAudioRecorder ? "Cancel recording" : "Record audio"}
            disabled={loading}
            onClick={() => setShowAudioRecorder((v) => !v)}
            className={cn(
              "shrink-0 h-11 w-11",
              showAudioRecorder
                ? "text-destructive hover:text-destructive"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Mic className="w-4 h-4" />
          </Button>

          {/* Textarea */}
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

          {/* Send button */}
          <Button
            onClick={() => void sendMessage(input)}
            disabled={loading || !hasReadyContent || isUploading}
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
