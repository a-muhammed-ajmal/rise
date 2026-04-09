'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronDown, ChevronUp, RefreshCw, MessageSquare, CheckCircle2,
  Circle, Star, Flame, ArrowRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { updateDocById } from '@/lib/firestore';
import { COLLECTIONS, AFFIRMATIONS } from '@/lib/constants';
import {
  getTimeGreeting, formatDayDateTime, formatAED, getMonthYear,
  todayISO, randomItem, cn,
} from '@/lib/utils';
import type { Task, Habit, Transaction, Project } from '@/lib/types';
import { SkeletonStats, SkeletonCard, SkeletonListItem } from '@/components/ui/SkeletonCard';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/lib/toast';
import { getIdToken } from '@/lib/verify-auth';
import { LS_KEYS } from '@/lib/constants';

// ─── QUICK STATS ─────────────────────────────────────────────────────────────
function QuickStats({
  tasks, habits, transactions, projects,
}: {
  tasks: Task[]; habits: Habit[]; transactions: Transaction[]; projects: Project[];
}) {
  const today = todayISO();
  const thisMonth = getMonthYear();

  const doneToday = tasks.filter((t) => t.isCompleted && t.completedAt?.startsWith(today)).length;
  const activeTargets = projects.filter((p) => !p.isFavorite).length;
  const avgStreak = habits.length
    ? Math.round(habits.reduce((sum, h) => sum + h.streak, 0) / habits.length)
    : 0;
  const monthlyIncome = transactions
    .filter((t) => t.type === 'Income' && t.date.startsWith(thisMonth))
    .reduce((s, t) => s + t.amount, 0);
  const monthlyExpenses = transactions
    .filter((t) => t.type === 'Expense' && t.date.startsWith(thisMonth))
    .reduce((s, t) => s + t.amount, 0);
  const surplus = monthlyIncome - monthlyExpenses;

  const stats = [
    { label: 'Done today', value: doneToday, color: '#1ABC9C' },
    { label: 'Active Targets', value: activeTargets, color: '#1E4AFF' },
    { label: 'Avg Streak', value: `${avgStreak}d`, color: '#FF6B35' },
    {
      label: surplus >= 0 ? 'Surplus' : 'Deficit',
      value: formatAED(Math.abs(surplus)),
      color: surplus >= 0 ? '#1ABC9C' : '#FF4F6D',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((s) => (
        <div key={s.label} className="bg-[#141414] rounded-card p-4 border border-[#2A2A2A]">
          <p className="text-xs text-[#8A8A8A]">{s.label}</p>
          <p className="text-xl font-bold mt-1" style={{ color: s.color }}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── WINNERS MINDSET ─────────────────────────────────────────────────────────
function WinnersMindset() {
  const [open, setOpen] = useState(false);
  const [affirmation, setAffirmation] = useState(() => randomItem(AFFIRMATIONS));
  return (
    <div className="bg-[#141414] rounded-card border border-[#2A2A2A] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-[#F0F0F0]"
      >
        <span>🏆 Winner&apos;s Mindset</span>
        {open ? <ChevronUp size={16} className="text-[#8A8A8A]" /> : <ChevronDown size={16} className="text-[#8A8A8A]" />}
      </button>
      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          <p className="text-sm text-[#F0F0F0] leading-relaxed italic">&ldquo;{affirmation}&rdquo;</p>
          <button
            onClick={() => setAffirmation(randomItem(AFFIRMATIONS))}
            className="flex items-center gap-1.5 text-xs text-[#FF6B35]"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      )}
    </div>
  );
}

// ─── AI TIP CARD ─────────────────────────────────────────────────────────────
function AiTipCard({ userId }: { userId: string }) {
  const [tip, setTip] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const key = `${LS_KEYS.DAILY_TIP_PREFIX}${todayISO()}`;
    const cached = localStorage.getItem(key);
    if (cached) { setTip(cached); setLoading(false); return; }

    (async () => {
      try {
        const token = await getIdToken();
        const res = await fetch('/api/ai-tip', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const text = data.tip ?? 'Keep showing up. Consistency compounds.';
        localStorage.setItem(key, text);
        setTip(text);
      } catch {
        setTip('Keep showing up. Consistency compounds.');
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  return (
    <div className="bg-[#141414] rounded-card border border-[#2A2A2A] p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">✨</span>
        <span className="text-xs font-semibold text-[#FF6B35] uppercase tracking-wider">Daily AI Tip</span>
      </div>
      {loading ? (
        <div className="h-4 bg-[#1C1C1C] rounded animate-pulse w-full" />
      ) : (
        <p className="text-sm text-[#F0F0F0] leading-relaxed">{tip}</p>
      )}
    </div>
  );
}

// ─── TODAY'S RHYTHMS ─────────────────────────────────────────────────────────
function TodayRhythms({ habits, loading }: { habits: Habit[]; loading: boolean }) {
  const today = todayISO();
  const todayHabits = habits.filter((h) => h.isActive && h.frequency === 'daily');

  const markDone = async (habit: Habit) => {
    const completions = { ...habit.completions, [today]: (habit.completions[today] ?? 0) + 1 };
    const statusLog = { ...habit.statusLog, [today]: 'done' as const };
    await updateDocById(COLLECTIONS.HABITS, habit.id, { completions, statusLog });
    toast.success(`${habit.name} ✓`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[#F0F0F0]">Today&apos;s Rhythms</h2>
        <a href="/wellness" className="text-xs text-[#FF6B35] flex items-center gap-1">
          See All <ArrowRight size={12} />
        </a>
      </div>
      {loading ? (
        <div className="flex gap-3 overflow-hidden">
          {[1,2,3].map((i) => (
            <div key={i} className="flex-shrink-0 w-32 h-24 bg-[#141414] rounded-card border border-[#2A2A2A] animate-pulse" />
          ))}
        </div>
      ) : todayHabits.length === 0 ? (
        <div className="bg-[#141414] rounded-card border border-[#2A2A2A] p-4 text-center">
          <p className="text-sm text-[#8A8A8A]">No rhythms scheduled for today.</p>
          <a href="/wellness" className="text-xs text-[#FF6B35] mt-1 block">Add one →</a>
        </div>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
          {todayHabits.map((habit) => {
            const done = habit.statusLog[today] === 'done';
            return (
              <div
                key={habit.id}
                className={cn(
                  'flex-shrink-0 w-36 bg-[#141414] rounded-card border p-3 flex flex-col gap-2',
                  done ? 'border-[#1ABC9C]' : 'border-[#2A2A2A]'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xl">{habit.icon}</span>
                  <span className="text-xs text-[#FF6B35] flex items-center gap-0.5">
                    <Flame size={10} /> {habit.streak}
                  </span>
                </div>
                <p className="text-xs font-medium text-[#F0F0F0] leading-tight line-clamp-2">{habit.name}</p>
                {!done && (
                  <button
                    onClick={() => markDone(habit)}
                    className="h-8 w-full rounded-button bg-[#1ABC9C]/15 text-[#1ABC9C] text-xs font-semibold"
                  >
                    Done
                  </button>
                )}
                {done && (
                  <span className="text-xs text-[#1ABC9C] text-center">✓ Complete</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── UPCOMING ACTIONS ─────────────────────────────────────────────────────────
function UpcomingActions({ tasks, loading }: { tasks: Task[]; loading: boolean }) {
  const today = todayISO();
  const upcoming = tasks
    .filter((t) => !t.isCompleted && t.dueDate && t.dueDate <= today)
    .sort((a, b) => {
      const pa = parseInt(a.priority.slice(1));
      const pb = parseInt(b.priority.slice(1));
      return pa !== pb ? pa - pb : (a.dueTime ?? '').localeCompare(b.dueTime ?? '');
    })
    .slice(0, 5);

  const completeTask = async (task: Task) => {
    await updateDocById(COLLECTIONS.TASKS, task.id, {
      isCompleted: true,
      completedAt: new Date().toISOString(),
    });
    toast.success('Action completed! 🎉');
  };

  const priorityColors: Record<string, string> = {
    P1: '#FF4F6D', P2: '#FF6B35', P3: '#1E4AFF', P4: '#8A8A8A',
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-[#F0F0F0]">Upcoming Actions</h2>
        <a href="/tasks" className="text-xs text-[#FF6B35] flex items-center gap-1">
          See All <ArrowRight size={12} />
        </a>
      </div>
      {loading ? (
        <div className="bg-[#141414] rounded-card border border-[#2A2A2A] overflow-hidden">
          {[1,2,3].map((i) => <SkeletonListItem key={i} />)}
        </div>
      ) : upcoming.length === 0 ? (
        <div className="bg-[#141414] rounded-card border border-[#2A2A2A] p-4 text-center">
          <p className="text-sm text-[#8A8A8A]">All clear. No actions due today.</p>
        </div>
      ) : (
        <div className="bg-[#141414] rounded-card border border-[#2A2A2A] overflow-hidden">
          {upcoming.map((task, idx) => (
            <div
              key={task.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3',
                idx < upcoming.length - 1 && 'border-b border-[#2A2A2A]'
              )}
            >
              <button
                onClick={() => completeTask(task)}
                className="w-6 h-6 flex-shrink-0 flex items-center justify-center"
              >
                <Circle size={20} className="text-[#2A2A2A]" />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#F0F0F0] truncate">{task.title}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge label={task.realm} />
                  {task.dueDate && (
                    <span className="text-xs text-[#FF4F6D]">
                      {task.dueDate === today ? 'Today' : 'Overdue'}
                    </span>
                  )}
                </div>
              </div>
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: priorityColors[task.priority] }}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── DASHBOARD PAGE ───────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [dateTime, setDateTime] = useState(formatDayDateTime());

  const { data: tasks, loading: tasksLoading } = useCollection<Task>({
    userId: user?.uid ?? '',
    collectionName: COLLECTIONS.TASKS,
    enabled: !!user,
  });
  const { data: habits, loading: habitsLoading } = useCollection<Habit>({
    userId: user?.uid ?? '',
    collectionName: COLLECTIONS.HABITS,
    enabled: !!user,
  });
  const { data: transactions, loading: txLoading } = useCollection<Transaction>({
    userId: user?.uid ?? '',
    collectionName: COLLECTIONS.TRANSACTIONS,
    enabled: !!user,
  });
  const { data: projects, loading: projLoading } = useCollection<Project>({
    userId: user?.uid ?? '',
    collectionName: COLLECTIONS.PROJECTS,
    enabled: !!user,
  });

  const statsLoading = tasksLoading || habitsLoading || txLoading || projLoading;

  // Clock tick
  useEffect(() => {
    const interval = setInterval(() => setDateTime(formatDayDateTime()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Check onboarding
  useEffect(() => {
    if (!user) return;
    import('@/lib/firestore').then(({ getUserMeta }) => {
      getUserMeta(user.uid).then((meta) => {
        if (!meta?.onboardingComplete) router.replace('/onboarding');
      });
    });
  }, [user, router]);

  const firstName = user?.displayName?.split(' ')[0] ?? '';

  return (
    <div className="page-content flex flex-col gap-5 pb-6">
      {/* Greeting */}
      <div className="pt-2">
        <h1 className="text-xl font-bold text-[#F0F0F0]">{getTimeGreeting(firstName)}</h1>
        <p className="text-xs text-[#8A8A8A] mt-0.5">{dateTime}</p>
      </div>

      {/* Quick Stats */}
      {statsLoading ? <SkeletonStats /> : (
        <QuickStats
          tasks={tasks}
          habits={habits}
          transactions={transactions}
          projects={projects}
        />
      )}

      {/* Winner's Mindset */}
      <WinnersMindset />

      {/* AI Tip */}
      {user && <AiTipCard userId={user.uid} />}

      {/* Today's Rhythms */}
      <TodayRhythms habits={habits} loading={habitsLoading} />

      {/* Upcoming Actions */}
      <UpcomingActions tasks={tasks} loading={tasksLoading} />

      {/* AI Chat shortcut */}
      <button
        onClick={() => router.push('/chat')}
        className="bg-[#141414] rounded-card border border-[#2A2A2A] p-4 flex items-center gap-3 text-left active:bg-[#1C1C1C] transition-colors"
      >
        <div className="w-10 h-10 bg-[#FF9933]/15 rounded-full flex items-center justify-center flex-shrink-0">
          <MessageSquare size={18} className="text-[#FF9933]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#F0F0F0]">Ask RISE anything</p>
          <p className="text-xs text-[#8A8A8A]">Powered by Gemini AI</p>
        </div>
        <ArrowRight size={16} className="text-[#8A8A8A] ml-auto" />
      </button>
    </div>
  );
}
