'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection } from '@/lib/firestore';
import { Task, Goal, Habit, Transaction, Lead, Deal, Connection, Review, ChatMessage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Send, Bot, User, Sparkles } from 'lucide-react';

const QUICK_PROMPTS = [
  'What should I focus on today?',
  'How are my goals progressing?',
  'Summarize my finances this month',
  'What habits am I maintaining well?',
  'Give me a productivity tip',
];

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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const buildContext = () => {
    return JSON.stringify({
      tasks: tasks.slice(0, 50).map(t => ({ title: t.title, area: t.area, priority: t.priority, dueDate: t.dueDate, completed: t.isCompleted, isMyDay: t.isMyDay })),
      goals: goals.map(g => ({ title: g.title, area: g.area, progress: g.progress, timeline: g.timeline, completed: g.isCompleted })),
      habits: habits.map(h => ({ name: h.name, streak: h.streak, bestStreak: h.bestStreak })),
      // Transactions: amounts are intentional for financial analysis — no card numbers or account details stored
      transactions: transactions.slice(0, 30).map(t => ({ type: t.type, amount: t.amount, category: t.category, date: t.date })),
      // Leads/Deals: client names and sensitive identifiers (Emirates ID, passport, AECB, salary) are stripped
      leads: leads.map((l, i) => ({ ref: `Lead-${i + 1}`, status: l.status, bank: l.bank, product: l.product })),
      deals: deals.map((d, i) => ({ ref: `Deal-${i + 1}`, status: d.status, bank: d.bank, product: d.product })),
      // Connections: only type sent; names are personal contacts the user wants referenced
      connections: connections.map(c => ({ name: c.name, type: c.type })),
      reviews: reviews.slice(0, 5).map(r => ({ date: r.weekStartDate, rating: r.rating, wins: r.wins })),
    });
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || !user) return;
    const userMsg: ChatMessage = { role: 'user', content: text.trim(), timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

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
      const aiMsg: ChatMessage = { role: 'assistant', content: data.reply || data.error || 'No response', timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      const errMsg = isTimeout
        ? 'Request timed out. Please try again.'
        : 'Sorry, something went wrong. Please try again.';
      setMessages(prev => [...prev, { role: 'assistant', content: errMsg, timestamp: new Date().toISOString() }]);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-rise to-amber-500 flex items-center justify-center mx-auto mb-4">
                <Sparkles size={28} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-text mb-2">RISE AI Assistant</h2>
              <p className="text-sm text-text-3 mb-6">Ask me anything about your tasks, goals, finances, habits, or life data</p>
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
                    ? 'bg-rise text-white rounded-br-md'
                    : 'bg-surface-2 text-text border border-border rounded-bl-md'
                )}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-rise/20 flex items-center justify-center shrink-0 mt-1">
                    <User size={16} className="text-rise" />
                  </div>
                )}
              </div>
            ))}
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

      {/* Input Bar */}
      <div className="border-t border-border bg-surface px-4 py-3 lg:px-8">
        <div className="max-w-2xl mx-auto flex gap-3">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
            placeholder="Ask RISE AI anything..."
            className="flex-1 px-4 py-3 rounded-xl border border-border bg-surface-2 text-sm text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-rise/30" />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || loading}
            className="w-12 h-12 rounded-xl bg-rise text-white flex items-center justify-center disabled:opacity-50 active:scale-95 transition-transform">
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
