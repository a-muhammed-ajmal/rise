'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Mic, MicOff, Trash2, MessageSquare, Volume2, VolumeX } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { createDoc, deleteDocById, queryDocs, where } from '@/lib/firestore';
import { COLLECTIONS } from '@/lib/constants';
import { cn, todayISO } from '@/lib/utils';
import type { ChatMessage, Task, Habit, Goal, Transaction } from '@/lib/types';
import { ConfirmModal } from '@/components/ui/Modal';
import { toast } from '@/lib/toast';
import { sanitize } from '@/lib/sanitizer';
import { getIdToken } from '@/lib/verify-auth';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

// ── Markdown helpers ────────────────────────────────────────────────────────

function parseInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*{1,3}[^*\n]+\*{1,3})/g);
  return parts.map((part, i) => {
    if (/^\*{3}[^*]+\*{3}$/.test(part)) return <strong key={i}>{part.slice(3, -3)}</strong>;
    if (/^\*{2}[^*]+\*{2}$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^\*[^*]+\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return <span key={i}>{part}</span>;
  });
}

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' = 'ul';

  const flushList = (key: number) => {
    if (listItems.length === 0) return;
    const Tag = listType === 'ol' ? 'ol' : 'ul';
    nodes.push(
      <Tag key={`list-${key}`} className={`${listType === 'ol' ? 'list-decimal' : 'list-disc'} pl-5 space-y-1 my-1`}>
        {listItems.map((item, j) => <li key={j}>{parseInline(item)}</li>)}
      </Tag>
    );
    listItems = [];
  };

  lines.forEach((line, i) => {
    const ul = line.match(/^[-*•]\s+(.*)/);
    const ol = line.match(/^\d+\.\s+(.*)/);
    if (ul) { if (listType !== 'ul' && listItems.length) flushList(i); listType = 'ul'; listItems.push(ul[1]); }
    else if (ol) { if (listType !== 'ol' && listItems.length) flushList(i); listType = 'ol'; listItems.push(ol[1]); }
    else {
      flushList(i);
      const trimmed = line.trim();
      if (trimmed !== '') {
        nodes.push(<p key={`p-${i}`} className="mb-1 last:mb-0 leading-relaxed">{parseInline(trimmed)}</p>);
      }
    }
  });
  flushList(lines.length);
  return <>{nodes}</>;
}

/** Strip markdown so speechSynthesis speaks clean text */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')
    .replace(/`[^`]+`/g, '$1')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .trim();
}

// ─── BUILD LEAN CONTEXT STRING ────────────────────────────────────────────────

function buildContext(
  tasks: Task[],
  habits: Habit[],
  goals: Goal[],
  transactions: Transaction[]
): string {
  const today = todayISO();

  const taskLines = tasks
    .filter((t) => !t.isCompleted)
    .slice(0, 30)
    .map((t) => `- [${t.priority}] ${t.title} (${t.realm}${t.dueDate ? ', due ' + t.dueDate : ''}${t.isMyDay ? ', My Day' : ''})`)
    .join('\n');

  const habitLines = habits
    .filter((h) => h.isActive)
    .map((h) => `- ${h.name} | streak: ${h.streak}d | today: ${h.statusLog[today] ?? 'pending'}`)
    .join('\n');

  const goalLines = goals
    .filter((g) => !g.isCompleted)
    .map((g) => `- ${g.title} (${g.category}, ${g.timeline}, ${g.progress}%)`)
    .join('\n');

  const recentTx = transactions
    .slice(-20)
    .map((t) => `- ${t.type} AED${t.amount} ${t.category} ${t.date}`)
    .join('\n');

  const parts: string[] = [];
  if (taskLines) parts.push(`OPEN ACTIONS:\n${taskLines}`);
  if (habitLines) parts.push(`RHYTHMS:\n${habitLines}`);
  if (goalLines) parts.push(`VISIONS:\n${goalLines}`);
  if (recentTx) parts.push(`RECENT TRANSACTIONS:\n${recentTx}`);

  return parts.join('\n\n');
}

// ────────────────────────────────────────────────────────────────────────────

const SUGGESTION_CHIPS = [
  'What should I focus on today?',
  'Review my week',
  'Help me plan a target',
  'Motivate me',
  'How are my rhythms going?',
];

const INPUT_CHIPS = [
  'What should I focus on today?',
  'Review my visions',
  'Motivate me',
];

export default function ChatPage() {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Track whether context has been injected this session
  const contextSentRef = useRef(false);

  const { data: messages, loading } = useCollection<ChatMessage>({
    userId: user?.uid ?? '',
    collectionName: COLLECTIONS.CHAT_MESSAGES,
    enabled: !!user,
  });
  const { data: tasks } = useCollection<Task>({
    userId: user?.uid ?? '',
    collectionName: COLLECTIONS.TASKS,
    enabled: !!user,
  });
  const { data: habits } = useCollection<Habit>({
    userId: user?.uid ?? '',
    collectionName: COLLECTIONS.HABITS,
    enabled: !!user,
  });
  const { data: goals } = useCollection<Goal>({
    userId: user?.uid ?? '',
    collectionName: COLLECTIONS.GOALS,
    enabled: !!user,
  });
  const { data: transactions } = useCollection<Transaction>({
    userId: user?.uid ?? '',
    collectionName: COLLECTIONS.TRANSACTIONS,
    enabled: !!user,
  });

  const sorted = [...messages].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const { isRecording, isTranscribing, startRecording, stopRecording } = useVoiceRecorder({
    onTranscript: (text) => {
      setInput((prev) => prev + (prev ? ' ' : '') + text);
    },
  });

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sorted.length, sending]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + 'px';
    }
  }, [input]);

  // Stop TTS on unmount
  useEffect(() => {
    return () => { if (typeof window !== 'undefined') window.speechSynthesis?.cancel(); };
  }, []);

  const toggleTTS = useCallback((msgId: string, text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (speakingId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
    } else {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(stripMarkdown(text));
      utterance.onend = () => setSpeakingId(null);
      utterance.onerror = () => setSpeakingId(null);
      window.speechSynthesis.speak(utterance);
      setSpeakingId(msgId);
    }
  }, [speakingId]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !user) return;
    setSending(true);
    const content = sanitize(text, 2000);
    setInput('');

    try {
      const now = new Date().toISOString();
      await createDoc(COLLECTIONS.CHAT_MESSAGES, {
        userId: user.uid,
        role: 'user',
        content,
        timestamp: now,
      });

      const token = await getIdToken();
      if (!token) throw new Error('Not authenticated');

      // Build history (last 10 messages)
      const history = sorted.slice(-10).map((m) => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.content }],
      }));

      // Inject context only on the FIRST message of the session to save tokens
      let context: string | undefined;
      if (!contextSentRef.current) {
        context = buildContext(tasks, habits, goals, transactions);
        if (context) contextSentRef.current = true;
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: content, history, ...(context ? { context } : {}) }),
      });

      if (!res.ok) throw new Error('API error');
      const data = await res.json();

      await createDoc(COLLECTIONS.CHAT_MESSAGES, {
        userId: user.uid,
        role: 'assistant',
        content: data.reply ?? 'I am here to help. What would you like to discuss?',
        timestamp: new Date().toISOString(),
      });
    } catch {
      toast.error('AI assistant is temporarily unavailable. Try again shortly.');
    } finally {
      setSending(false);
    }
  };

  const clearChat = async () => {
    if (!user) return;
    // Stop TTS if playing
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    setSpeakingId(null);
    // Reset context injection so the next first message re-injects context
    contextSentRef.current = false;
    try {
      const docs = await queryDocs<ChatMessage>(COLLECTIONS.CHAT_MESSAGES, [
        where('userId', '==', user.uid),
      ]);
      await Promise.all(docs.map((m) => deleteDocById(COLLECTIONS.CHAT_MESSAGES, m.id)));
      toast.success('Chat cleared.');
    } catch {
      toast.error('Failed to clear chat.');
    }
    setClearOpen(false);
  };

  const firstName = user?.displayName?.split(' ')[0] ?? 'there';

  return (
    <div className="flex flex-col h-[calc(100dvh-48px-64px)] sm:h-[calc(100dvh)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5EA] bg-[#F2F2F7]">
        <h1 className="text-base font-bold text-[#1C1C1E]">AI Chat</h1>
        <button
          onClick={() => setClearOpen(true)}
          className="w-8 h-8 flex items-center justify-center text-[#6C6C70] hover:text-[#FF4F6D]"
          title="Clear chat"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {sorted.length === 0 && !sending && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="w-16 h-16 bg-[#FF9933]/15 rounded-full flex items-center justify-center">
              <MessageSquare size={28} className="text-[#FF9933]" />
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-[#1C1C1E]">How can I help you today, {firstName}?</p>
              <p className="text-sm text-[#6C6C70] mt-1">Powered by Gemini AI</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  className="p-3 bg-[#FFFFFF] border border-[#E5E5EA] rounded-card text-xs text-[#1C1C1E] text-left hover:bg-[#F5F5F5] transition-colors active:scale-[0.98]"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {sorted.map((msg) => (
          <div
            key={msg.id}
            className={cn('flex flex-col gap-1 max-w-[85%]', msg.role === 'user' ? 'self-end items-end' : 'self-start items-start')}
          >
            {msg.role === 'assistant' && (
              <div className="w-6 h-6 bg-[#FF9933]/15 rounded-full flex items-center justify-center mb-1">
                <span className="text-xs font-bold text-[#FF9933]">R</span>
              </div>
            )}
            <div
              className={cn(
                'rounded-card px-4 py-3 text-sm',
                msg.role === 'user'
                  ? 'bg-[#FF6B35] text-white leading-relaxed'
                  : 'bg-[#FFFFFF] text-[#1C1C1E] border border-[#E5E5EA]'
              )}
            >
              {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#AEAEB2]">
                {new Date(msg.timestamp).toLocaleTimeString('en-AE', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {msg.role === 'assistant' && (
                <button
                  type="button"
                  onClick={() => toggleTTS(msg.id, msg.content)}
                  className="w-5 h-5 flex items-center justify-center text-[#AEAEB2] hover:text-[#FF9933] transition-colors"
                  aria-label={speakingId === msg.id ? 'Stop speaking' : 'Listen'}
                  title={speakingId === msg.id ? 'Stop' : 'Listen'}
                >
                  {speakingId === msg.id
                    ? <VolumeX size={12} />
                    : <Volume2 size={12} />}
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {sending && (
          <div className="self-start flex flex-col gap-1">
            <div className="w-6 h-6 bg-[#FF9933]/15 rounded-full flex items-center justify-center mb-1">
              <span className="text-xs font-bold text-[#FF9933]">R</span>
            </div>
            <div className="bg-[#FFFFFF] border border-[#E5E5EA] rounded-card px-4 py-3 flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="w-1.5 h-1.5 bg-[#6C6C70] rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-[#E5E5EA] bg-[#F2F2F7] pb-safe">
        {/* Quick prompts above input (shown when conversation exists) */}
        {sorted.length > 0 && (
          <div className="flex gap-2 px-4 pt-2 overflow-x-auto no-scrollbar">
            {INPUT_CHIPS.map((chip) => (
              <button
                key={chip}
                onClick={() => sendMessage(chip)}
                disabled={sending}
                className="flex-shrink-0 px-3 py-1.5 bg-[#FFFFFF] border border-[#E5E5EA] rounded-full text-[11px] text-[#6C6C70] hover:bg-[#F5F5F5] transition-colors disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 items-end px-4 py-3">
          {/* Voice button */}
          <button
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onTouchStart={startRecording}
            onTouchEnd={stopRecording}
            disabled={sending}
            className={cn(
              'w-11 h-11 flex-shrink-0 rounded-full flex items-center justify-center transition-colors',
              isRecording ? 'bg-[#FF4F6D]' : 'bg-[#F5F5F5] border border-[#E5E5EA]'
            )}
            aria-label="Voice input"
          >
            {isRecording ? <MicOff size={17} className="text-white" /> : <Mic size={17} className="text-[#6C6C70]" />}
          </button>

          {/* Text input */}
          <textarea
            ref={textareaRef}
            value={isTranscribing ? 'Transcribing...' : input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
            }}
            placeholder="Ask RISE anything..."
            disabled={sending || isTranscribing}
            rows={1}
            className="flex-1 bg-[#F5F5F5] border border-[#E5E5EA] rounded-input px-3 py-2.5 text-sm text-[#1C1C1E] placeholder-[#AEAEB2] outline-none focus:border-[#FF6B35] resize-none transition-colors disabled:opacity-50"
          />

          {/* Send button */}
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || sending}
            className="w-11 h-11 flex-shrink-0 bg-[#FF9933] rounded-full flex items-center justify-center disabled:opacity-40 transition-opacity active:scale-95"
            aria-label="Send"
          >
            <Send size={17} className="text-white" />
          </button>
        </div>
        <p className="text-[10px] text-[#AEAEB2] text-center pb-2">Powered by Gemini</p>
      </div>

      <ConfirmModal
        open={clearOpen}
        onClose={() => setClearOpen(false)}
        onConfirm={clearChat}
        title="Clear Chat"
        message="This will delete all chat messages. This cannot be undone."
        confirmLabel="Clear"
      />
    </div>
  );
}
