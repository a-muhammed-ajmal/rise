'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection } from '@/lib/firestore';
import { Task, Goal, Habit, Transaction, Lead, Deal, Connection, Review, ChatMessage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Send, Bot, User, Sparkles, RefreshCw, Trash2, MessageSquare, Mic, Square, Volume2, VolumeX, X, Loader2 } from 'lucide-react';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

const QUICK_PROMPTS = [
  'What should I focus on today?',
  'How are my goals progressing?',
  'Summarize my finances this month',
  'What rhythms am I maintaining well?',
  'Give me a productivity tip',
];

// ─── Text-to-Speech helper ───────────────────────────────────────────────────

function useTTS() {
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const [speakingId, setSpeakingId] = useState<number | null>(null);

  const speak = useCallback((text: string, messageIndex: number) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    // Stop any current speech
    window.speechSynthesis.cancel();

    if (speakingId === messageIndex) {
      setSpeakingId(null);
      return;
    }

    // Strip markdown for cleaner speech
    const clean = text
      .replace(/```[\s\S]*?```/g, ' code block ')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^[-*]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/\n+/g, '. ');

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    utteranceRef.current = utterance;
    setSpeakingId(messageIndex);
    window.speechSynthesis.speak(utterance);
  }, [speakingId]);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    setSpeakingId(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { stop(); }, [stop]);

  return { speak, stop, speakingId };
}

// ─── Voice Recording Bar ─────────────────────────────────────────────────────

interface VoiceBarProps {
  duration: number;
  isTranscribing: boolean;
  onStop: () => void;
  onCancel: () => void;
}

function VoiceRecordingBar({ duration, isTranscribing, onStop, onCancel }: VoiceBarProps) {
  const mins = Math.floor(duration / 60);
  const secs = duration % 60;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-surface-2 rounded-xl border border-red-500/30 animate-fade-up">
      {isTranscribing ? (
        <>
          <Loader2 size={18} className="text-rise animate-spin" />
          <span className="flex-1 text-sm text-text-2">Transcribing...</span>
        </>
      ) : (
        <>
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="flex-1 text-sm text-text font-medium">
            Recording <span className="text-text-3 font-mono">{mins}:{secs.toString().padStart(2, '0')}</span>
          </span>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-surface-3 text-text-3 transition-colors" title="Cancel">
            <X size={18} />
          </button>
          <button onClick={onStop}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors">
            <Square size={14} fill="currentColor" /> Stop
          </button>
        </>
      )}
    </div>
  );
}

// ─── Main Chat Page ──────────────────────────────────────────────────────────

export default function ChatPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: tasks } = useCollection<Task>('tasks', uid);
  const { data: goals } = useCollection<Goal>('goals', uid);
  const { data: habits } = useCollection<Habit>('habits', uid);
  const { data: transactions } = useCollection<Transaction>('transactions', uid);
  const { data: leads } = useCollection<Lead>('leads', uid);
  const { data: deals } = useCollection<Deal>('deals', uid);
  const { data: connections } = useCollection<Connection>('connections', uid);
  const { data: reviews } = useCollection<Review>('reviews', uid);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { state: recorderState, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();
  const { speak, speakingId } = useTTS();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Show recorder errors
  useEffect(() => {
    if (recorderState.error) setVoiceError(recorderState.error);
  }, [recorderState.error]);

  // Auto-dismiss voice error
  useEffect(() => {
    if (!voiceError) return;
    const t = setTimeout(() => setVoiceError(null), 5000);
    return () => clearTimeout(t);
  }, [voiceError]);

  // ─── Markdown Rendering ──────────────────────────────────────────────

  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      if (line.trim().startsWith('```')) {
        const codeLines: string[] = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++;
        elements.push(
          <pre key={elements.length} className="bg-surface-3 p-3 rounded-lg text-xs font-mono overflow-x-auto my-2">
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        continue;
      }

      if (/^[\s]*[-*]\s+/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^[\s]*[-*]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^[\s]*[-*]\s+/, ''));
          i++;
        }
        elements.push(
          <ul key={elements.length} className="list-disc pl-4 my-1">
            {items.map((item, j) => <li key={j}>{inlineMarkdown(item)}</li>)}
          </ul>
        );
        continue;
      }

      if (/^[\s]*\d+\.\s+/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^[\s]*\d+\.\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^[\s]*\d+\.\s+/, ''));
          i++;
        }
        elements.push(
          <ol key={elements.length} className="list-decimal pl-4 my-1">
            {items.map((item, j) => <li key={j}>{inlineMarkdown(item)}</li>)}
          </ol>
        );
        continue;
      }

      if (line.trim() === '') {
        elements.push(<br key={elements.length} />);
        i++;
        continue;
      }

      elements.push(<p key={elements.length} className="my-0.5">{inlineMarkdown(line)}</p>);
      i++;
    }

    return <div className="space-y-0.5">{elements}</div>;
  };

  const inlineMarkdown = (text: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    const codeRegex = /`([^`]+)`/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(...boldify(text.slice(lastIndex, match.index), parts.length));
      }
      parts.push(
        <code key={`c${parts.length}`} className="bg-surface-3 px-1 py-0.5 rounded text-xs font-mono">
          {match[1]}
        </code>
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push(...boldify(text.slice(lastIndex), parts.length));
    }
    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  const boldify = (text: string, keyOffset: number): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    const boldRegex = /\*\*(.+?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = boldRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`b${keyOffset}${parts.length}`}>{text.slice(lastIndex, match.index)}</span>);
      }
      parts.push(<strong key={`s${keyOffset}${parts.length}`} className="font-semibold">{match[1]}</strong>);
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      parts.push(<span key={`t${keyOffset}${parts.length}`}>{text.slice(lastIndex)}</span>);
    }
    return parts;
  };

  // ─── Context Builder ─────────────────────────────────────────────────

  const buildContext = () => {
    return JSON.stringify({
      tasks: tasks.slice(0, 50).map(t => ({ title: t.title, area: t.area, priority: t.priority, dueDate: t.dueDate, completed: t.isCompleted, isMyDay: t.isMyDay })),
      goals: goals.map(g => ({ title: g.title, area: g.area, progress: g.progress, timeline: g.timeline, completed: g.isCompleted })),
      habits: habits.map(h => ({ name: h.name, streak: h.streak, bestStreak: h.bestStreak })),
      transactions: transactions.slice(0, 30).map(t => ({ type: t.type, amount: t.amount, category: t.category, date: t.date })),
      leads: leads.map((l, i) => ({ ref: `Lead-${i + 1}`, status: l.status, bank: l.bank, product: l.product })),
      deals: deals.map((d, i) => ({ ref: `Deal-${i + 1}`, status: d.status, bank: d.bank, product: d.product })),
      connections: connections.map(c => ({ name: c.name, type: c.type })),
      reviews: reviews.slice(0, 5).map(r => ({ date: r.weekStartDate, rating: r.rating, wins: r.wins })),
    });
  };

  // ─── Send Message ────────────────────────────────────────────────────

  const sendMessage = async (text: string) => {
    if (!text.trim() || !user) return;
    const userMsg: ChatMessage = { role: 'user', content: text.trim(), timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setLastError(false);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch('/api/chat', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({
          message: text.trim(),
          context: buildContext(),
          history: messages.slice(-10),
        }),
      });
      const data = await res.json();
      if (data.error) {
        setLastError(true);
        setMessages(prev => [...prev, { role: 'assistant', content: data.error, timestamp: new Date().toISOString() }]);
      } else {
        const aiMsg: ChatMessage = { role: 'assistant', content: data.reply || 'No response', timestamp: new Date().toISOString() };
        setMessages(prev => [...prev, aiMsg]);
      }
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      const errMsg = isTimeout
        ? 'Request timed out. Please try again.'
        : 'Sorry, something went wrong. Please try again.';
      setLastError(true);
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg, timestamp: new Date().toISOString() }]);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  // ─── Voice Recording Flow ────────────────────────────────────────────

  const handleMicPress = async () => {
    if (recorderState.isRecording) return;
    setVoiceError(null);
    await startRecording();
  };

  const handleStopRecording = async () => {
    setIsTranscribing(true);
    const blob = await stopRecording();
    if (!blob) {
      setIsTranscribing(false);
      return;
    }

    try {
      const idToken = await user!.getIdToken();
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${idToken}` },
        body: formData,
      });

      const data = await res.json();
      if (data.error) {
        setVoiceError(data.error);
        setIsTranscribing(false);
        return;
      }

      setIsTranscribing(false);

      // Use the cleaned transcript to send the message
      if (data.cleanedTranscript) {
        sendMessage(data.cleanedTranscript);
      }
    } catch {
      setVoiceError('Failed to transcribe. Please try again.');
      setIsTranscribing(false);
    }
  };

  const handleCancelRecording = () => {
    cancelRecording();
    setIsTranscribing(false);
  };

  // ─── Other Handlers ──────────────────────────────────────────────────

  const retryLastMessage = () => {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;
    setMessages(prev => prev.slice(0, -2));
    sendMessage(lastUserMsg.content);
  };

  const clearChat = () => {
    setMessages([]);
    setLastError(false);
    inputRef.current?.focus();
  };

  const isRecordingOrTranscribing = recorderState.isRecording || isTranscribing;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      {messages.length > 0 && (
        <div className="flex items-center justify-between px-4 py-2 lg:px-8 border-b border-border bg-surface">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-text-3" />
            <span className="text-sm font-medium text-text">RISE AI Chat</span>
          </div>
          <button onClick={clearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-3 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
            <Trash2 size={14} />
            Clear
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rise to-amber-500 flex items-center justify-center mx-auto mb-4">
                <Sparkles size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-text mb-2">RISE AI Assistant</h2>
              <p className="text-sm text-text-3 mb-2">Ask me anything about your actions, targets, finances, rhythms, or life data</p>
              <p className="text-xs text-text-3 mb-6 flex items-center justify-center gap-1.5">
                <Mic size={12} /> Tap the mic button to use voice input
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {QUICK_PROMPTS.map(p => (
                  <button key={p} onClick={() => sendMessage(p)}
                    className="px-4 py-2 rounded-full text-sm font-medium bg-surface-2 text-text-2 border border-border hover:border-rise hover:text-rise transition-colors">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0 mt-1">
                    <Bot size={16} className="text-purple-600" />
                  </div>
                )}
                <div className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
                  msg.role === 'user'
                    ? 'bg-rise text-[#0A0A0F] rounded-br-md'
                    : 'bg-surface-2 text-text border border-border rounded-bl-md'
                )}>
                  {msg.role === 'user' ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <>
                      {renderMarkdown(msg.content)}
                      {/* TTS button on assistant messages */}
                      <button
                        onClick={() => speak(msg.content, i)}
                        className="mt-2 flex items-center gap-1 text-[11px] text-text-3 hover:text-rise transition-colors"
                        title={speakingId === i ? 'Stop speaking' : 'Read aloud'}
                      >
                        {speakingId === i ? <VolumeX size={12} /> : <Volume2 size={12} />}
                        {speakingId === i ? 'Stop' : 'Listen'}
                      </button>
                    </>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-rise/20 flex items-center justify-center shrink-0 mt-1">
                    <User size={16} className="text-rise" />
                  </div>
                )}
              </div>
            ))}
            {lastError && !loading && (
              <div className="flex justify-start pl-11">
                <button onClick={retryLastMessage}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-3 hover:text-rise hover:bg-rise/10 transition-colors">
                  <RefreshCw size={14} />
                  Retry
                </button>
              </div>
            )}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
                  <Bot size={16} className="text-purple-600" />
                </div>
                <div className="bg-surface-2 border border-border rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-text-3 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-text-3 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-text-3 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Voice Error Toast */}
      {voiceError && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 max-w-sm w-[90%] z-50">
          <div className="bg-red-500/90 text-white text-sm px-4 py-2.5 rounded-xl flex items-center gap-2 animate-fade-up">
            <span className="flex-1">{voiceError}</span>
            <button onClick={() => setVoiceError(null)} className="shrink-0"><X size={14} /></button>
          </div>
        </div>
      )}

      {/* Input Bar */}
      <div className="border-t border-border bg-surface px-4 py-3 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Recording bar replaces input when recording */}
          {isRecordingOrTranscribing ? (
            <VoiceRecordingBar
              duration={recorderState.duration}
              isTranscribing={isTranscribing}
              onStop={handleStopRecording}
              onCancel={handleCancelRecording}
            />
          ) : (
            <>
              {messages.length > 0 && (
                <div className="flex gap-2 mb-2 overflow-x-auto pb-1">
                  {QUICK_PROMPTS.slice(0, 3).map(p => (
                    <button key={p} onClick={() => sendMessage(p)} disabled={loading}
                      className="px-3 py-1 rounded-full text-xs font-medium bg-surface-2 text-text-3 border border-border hover:border-rise hover:text-rise transition-colors whitespace-nowrap shrink-0 disabled:opacity-50">
                      {p}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                {/* Mic button */}
                <button
                  onClick={handleMicPress}
                  disabled={loading}
                  className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center transition-all shrink-0',
                    'bg-surface-2 border border-border text-text-2 hover:text-rise hover:border-rise/30',
                    'disabled:opacity-50 active:scale-95',
                  )}
                  title="Voice input"
                >
                  <Mic size={20} />
                </button>
                {/* Text input */}
                <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
                  placeholder="Ask RISE AI anything..."
                  autoFocus
                  className="flex-1 px-4 py-3 rounded-xl border border-border bg-surface-2 text-sm text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-rise/30" />
                {/* Send button */}
                <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
                  className="w-12 h-12 rounded-xl bg-rise text-[#0A0A0F] flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform shrink-0">
                  <Send size={20} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
