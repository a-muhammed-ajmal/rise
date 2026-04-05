'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection, updateDocument } from '@/lib/firestore';
import { Task, Habit, Project, Goal, Transaction } from '@/lib/types';
import { cn, isOverdue, formatCurrency, formatTime } from '@/lib/utils';
import { format, startOfMonth } from 'date-fns';
import { ChevronDown, ChevronUp, Clock, Target, Wallet, Flame, CheckCircle2, ArrowRight, Check, X } from 'lucide-react';
import TaskCard from '@/components/tasks/TaskCard';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { HabitStatus } from '@/lib/types';

const AFFIRMATIONS = [
  "I am a top performer who creates massive value for my clients.",
  "Every 'no' brings me closer to a 'yes.' Rejection is redirection.",
  "I am disciplined, focused, and unstoppable.",
  "Success is my natural state. I was born to win.",
  "I turn obstacles into opportunities.",
  "My income grows as I grow. I invest in myself daily.",
  "I am worthy of abundance, prosperity, and financial freedom.",
  "Rest is part of my success strategy, not a weakness.",
  "I attract ideal clients effortlessly because I provide real value.",
  "Every single day, I am getting better at what I do.",
  "I am a magnet for financial opportunities, and abundance flows to me easily.",
  "I am confident in my skills, my choices, and my worth.",
  "I accept myself completely. I deserve all the good things life has to offer.",
  "My mind is calm, and my body is strong and full of energy.",
  "I have the power to achieve anything I can imagine. My potential has no limits.",
  "Love flows freely in my family. I give and receive love.",
  "My family is my strength, sharing happiness and support.",
  "Taking care of my loved ones is easy and brings me joy.",
  "I have plenty of money to make my family's dreams come true.",
  "I create strong, honest, and meaningful connections everywhere I go.",
  "I let go of all negativity. I breathe in peace, success, and pure happiness.",
];

function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17) return 'Good evening';
  return 'Up late';
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (a.length));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SHUFFLED_AFFIRMATIONS = shuffle(AFFIRMATIONS);

export default function DashboardPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: tasks } = useCollection<Task>('tasks', uid);
  const { data: projects } = useCollection<Project>('projects', uid);
  const { data: habits } = useCollection<Habit>('habits', uid);
  const { data: goals } = useCollection<Goal>('goals', uid);
  const { data: transactions } = useCollection<Transaction>('transactions', uid);

  const [now, setNow] = useState(new Date());
  const [affirmationsOpen, setAffirmationsOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const today = format(now, 'yyyy-MM-dd');

  // Quick Stats
  const tasksCompletedToday = useMemo(() =>
    (tasks || []).filter(t => t.completedAt && t.completedAt.startsWith(today)).length,
    [tasks, today]
  );

  const activeGoals = useMemo(() =>
    (goals || []).filter(g => !g.isCompleted),
    [goals]
  );

  const avgStreak = useMemo(() => {
    const activeHabits = (habits || []).filter(h => h.isActive);
    if (activeHabits.length === 0) return 0;
    const total = activeHabits.reduce((sum, h) => sum + (h.streak ?? 0), 0);
    return Math.round(total / activeHabits.length);
  }, [habits]);

  const monthlyBalance = useMemo(() => {
    const monthStart = format(startOfMonth(now), 'yyyy-MM-dd');
    const monthTxns = (transactions || []).filter(t => t.date >= monthStart && t.date <= today);
    const income = monthTxns.filter(t => t.type === 'Income').reduce((s, t) => s + t.amount, 0);
    const expense = monthTxns.filter(t => t.type === 'Expense').reduce((s, t) => s + t.amount, 0);
    return income - expense;
  }, [transactions, now, today]);

  const topGoals = useMemo(() =>
    activeGoals
      .sort((a, b) => b.progress - a.progress)
      .slice(0, 3),
    [activeGoals]
  );

  // Today's Focus: max 3 tasks, incomplete first
  const focusTasks = useMemo(() =>
    (tasks || [])
      .filter(t => t.isMyDay)
      .sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted))
      .slice(0, 3),
    [tasks]
  );

  // Get Things Done: first 5 tasks (today's tasks or My Day)
  const todayTasks = useMemo(() =>
    (tasks || [])
      .filter(t => t.isMyDay || t.dueDate === today)
      .sort((a, b) => Number(a.isCompleted) - Number(b.isCompleted))
      .slice(0, 5),
    [tasks, today]
  );

  async function toggleTask(id: string, done: boolean) {
    await updateDocument('tasks', id, {
      isCompleted: done,
      completedAt: done ? new Date().toISOString() : null,
    });
  }

  const handleTaskEdit = (task: Task) => {
    console.log('Edit task from home:', task.id);
  };

  // Build shared props for TaskCard
  const sharedCardProps = useMemo(() => ({
    projects: projects || [],
    userId: uid ?? '',
    onEdit: handleTaskEdit,
  }), [projects, uid]);

  const stats = [
    { icon: CheckCircle2, value: tasksCompletedToday, label: 'Done today', color: '#10B981' },
    { icon: Target, value: activeGoals.length, label: 'Active targets', color: '#3B82F6' },
    { icon: Flame, value: `${avgStreak}d`, label: 'Avg streak', color: '#FF9933' },
    { icon: Wallet, value: formatCurrency(Math.abs(monthlyBalance)), label: monthlyBalance >= 0 ? 'Surplus' : 'Deficit', color: monthlyBalance >= 0 ? '#10B981' : '#EF4444' },
  ];

  return (
    <div className="px-4 py-6 lg:px-8 max-w-3xl mx-auto space-y-5">

      {/* Dynamic Greeting */}
      <div className="animate-fade-up">
        <h1 className="text-xl font-bold text-text tracking-tight">
          {getGreeting(now.getHours())}, {user?.displayName?.split(' ')[0] || 'Ajmal'}
        </h1>
        <p className="text-[13px] text-text-3 mt-1">
          {format(now, 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 animate-fade-up delay-1">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="glow-card bg-surface-2 rounded-xl border border-white/[0.06] p-3.5 flex items-center gap-3 hover:border-white/[0.1] transition-colors">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stat.color}12` }}>
                <Icon size={17} style={{ color: stat.color }} />
              </div>
              <div>
                <p className="text-base font-bold text-text leading-tight">{stat.value}</p>
                <p className="text-[11px] text-text-3 mt-0.5">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Winner's Mindset */}
      <div className="glow-card bg-surface-2 rounded-xl border border-white/[0.06] overflow-hidden hover:border-white/[0.1] transition-colors animate-fade-up delay-2">
        <button
          onClick={() => setAffirmationsOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-[13px] font-semibold text-text">Winner&apos;s Mindset</span>
          {affirmationsOpen
            ? <ChevronUp size={15} className="text-text-3" />
            : <ChevronDown size={15} className="text-text-3" />}
        </button>
        {affirmationsOpen && (
          <div className="px-4 pb-4 space-y-2 border-t border-white/[0.04] pt-3">
            {SHUFFLED_AFFIRMATIONS.map((a, i) => (
              <div key={i} className="flex gap-2.5 text-[13px] text-text-2 leading-relaxed">
                <span className="text-rise shrink-0 mt-0.5">-</span>
                <span>{a}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Today's Focus */}
      <div className="glow-card bg-surface-2 rounded-xl border border-white/[0.06] p-4 hover:border-white/[0.1] transition-colors animate-fade-up delay-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[13px] font-semibold text-text">Today&apos;s Focus</h2>
          <span className="text-[11px] text-text-3 bg-white/[0.04] px-2 py-0.5 rounded-md font-medium">
            {focusTasks.length}/3
          </span>
        </div>
        {focusTasks.length === 0 ? (
          <p className="text-[13px] text-text-3 py-4 text-center">No focus actions. Mark actions as My Day.</p>
        ) : (
          <div className="space-y-2">
            {focusTasks.map(t => (
              <TaskCard key={t.id} task={t} {...sharedCardProps} />
            ))}
          </div>
        )}
      </div>

      {/* Be Consistent (Rhythms) */}
      <BeConsistentSection habits={habits || []} today={today} />

      {/* Get Things Done */}
      <div className="glow-card bg-surface-2 rounded-xl border border-white/[0.06] p-4 hover:border-white/[0.1] transition-colors animate-fade-up">
        <h2 className="text-[13px] font-semibold text-text mb-3">Get Things Done</h2>
        {todayTasks.length === 0 ? (
          <p className="text-[13px] text-text-3 py-4 text-center">No actions for today.</p>
        ) : (
          <div className="space-y-2">
            {todayTasks.map(t => (
              <TaskCard key={t.id} task={t} {...sharedCardProps} />
            ))}
          </div>
        )}
        <a
          href="/tasks"
          className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-white/[0.04] text-[12px] font-semibold text-rise hover:text-rise-dark transition-colors"
        >
          View all actions
          <ArrowRight size={12} />
        </a>
      </div>

      {/* Goal Progress */}
      {topGoals.length > 0 && (
        <div className="glow-card bg-surface-2 rounded-xl border border-white/[0.06] p-4 hover:border-white/[0.1] transition-colors animate-fade-up">
          <div className="flex items-center gap-2 mb-3">
            <Target size={15} className="text-blue-400" />
            <h2 className="text-[13px] font-semibold text-text">Target Progress</h2>
          </div>
          <div className="space-y-3.5">
            {topGoals.map(g => (
              <div key={g.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-text truncate mr-2">{g.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-medium text-text-3 bg-white/[0.04] px-1.5 py-0.5 rounded-md">
                      {g.area}
                    </span>
                    <span className="text-[12px] font-semibold text-text-2">{g.progress}%</span>
                  </div>
                </div>
                <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all"
                    style={{ width: `${Math.min(g.progress, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <a
            href="/goals"
            className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-white/[0.04] text-[12px] font-semibold text-rise hover:text-rise-dark transition-colors"
          >
            View all targets
            <ArrowRight size={12} />
          </a>
        </div>
      )}

    </div>
  );
}

// ─── Be Consistent: Rhythms Module ──────────────────────────────────────────

const INITIAL_SHOW = 5;

function BeConsistentSection({ habits, today }: { habits: Habit[]; today: string }) {
  const [expanded, setExpanded] = useState(false);

  const getTodayStatus = (h: Habit): HabitStatus => {
    return (h.statusLog?.[today] as HabitStatus) || 'pending';
  };

  // All rhythms sorted by time, pending ones only
  const pendingRhythms = useMemo(() =>
    habits
      .filter(h => h.isActive && getTodayStatus(h) === 'pending')
      .sort((a, b) => {
        if (!a.time && !b.time) return a.name.localeCompare(b.name);
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
      }),
    [habits, today]
  );

  const visibleRhythms = expanded ? pendingRhythms : pendingRhythms.slice(0, INITIAL_SHOW);
  const hasMore = pendingRhythms.length > INITIAL_SHOW;

  const markStatus = async (habit: Habit, status: HabitStatus) => {
    try {
      await runTransaction(db, async (transaction) => {
        const habitRef = doc(db, 'habits', habit.id);
        const snap = await transaction.get(habitRef);
        if (!snap.exists()) return;
        const data = snap.data();

        const completions: Record<string, number> = { ...(data.completions || {}) };
        const statusLog: Record<string, string> = { ...(data.statusLog || {}) };

        if (status === 'done') completions[today] = 1;
        else delete completions[today];
        statusLog[today] = status;

        let streak = 0;
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        if (!completions[format(d, 'yyyy-MM-dd')]) d.setDate(d.getDate() - 1);
        while (completions[format(d, 'yyyy-MM-dd')]) { streak++; d.setDate(d.getDate() - 1); }
        const bestStreak = Math.max(streak, data.bestStreak || 0);
        transaction.update(habitRef, { completions, statusLog, streak, bestStreak });
      });
    } catch (err) {
      console.error('[Dashboard] Failed to mark rhythm:', err);
    }
  };

  return (
    <div className="glow-card bg-surface-2 rounded-xl border border-white/[0.06] p-4 hover:border-white/[0.1] transition-colors animate-fade-up delay-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[13px] font-semibold text-text">Be Consistent</h2>
        <span className="text-[11px] text-text-3 bg-white/[0.04] px-2 py-0.5 rounded-md font-medium">
          {pendingRhythms.length} left
        </span>
      </div>

      {pendingRhythms.length === 0 ? (
        <p className="text-[13px] text-text-3 py-4 text-center">All rhythms completed for today!</p>
      ) : (
        <div className="space-y-1">
          {visibleRhythms.map(h => (
            <div key={h.id} className="flex items-center gap-3 py-2.5 border-b border-white/[0.04] last:border-0">
              <div className="flex-1 min-w-0">
                <span className="text-[13px] text-text block truncate">{h.name}</span>
                {h.time && (
                  <span className="flex items-center gap-1 text-[11px] text-text-3 mt-0.5">
                    <Clock size={10} />
                    {formatTime(h.time)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => markStatus(h, 'done')}
                  className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center hover:bg-green-500/25 transition-colors"
                >
                  <Check size={14} className="text-green-500" />
                </button>
                <button
                  onClick={() => markStatus(h, 'failed')}
                  className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center hover:bg-red-500/25 transition-colors"
                >
                  <X size={14} className="text-red-500" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-white/[0.04] w-full text-[12px] font-semibold text-rise hover:text-rise-dark transition-colors"
        >
          Show {pendingRhythms.length - INITIAL_SHOW} more
          <ChevronDown size={12} />
        </button>
      )}

      {expanded && hasMore && (
        <button
          onClick={() => setExpanded(false)}
          className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-white/[0.04] w-full text-[12px] font-semibold text-rise hover:text-rise-dark transition-colors"
        >
          Show less
          <ChevronUp size={12} />
        </button>
      )}

      <a
        href="/wellness"
        className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-white/[0.04] text-[12px] font-semibold text-rise hover:text-rise-dark transition-colors"
      >
        View all rhythms
        <ArrowRight size={12} />
      </a>
    </div>
  );
}
