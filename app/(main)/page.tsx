'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection, updateDocument } from '@/lib/firestore';
import { Task, Habit, Project, Goal, Transaction } from '@/lib/types';
import { cn, isOverdue, formatCurrency } from '@/lib/utils';
import { format, startOfMonth } from 'date-fns';
import { ChevronDown, ChevronUp, Clock, Target, Wallet, Flame, CheckCircle2 } from 'lucide-react';
import TaskCard from '@/components/tasks/TaskCard';

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
    // Navigation to tasks page with edit modal would be handled by routing
    // For now, this is a placeholder
    console.log('Edit task from home:', task.id);
  };

  // Build shared props for TaskCard
  const sharedCardProps = useMemo(() => ({
    projects: projects || [],
    userId: uid ?? '',
    onEdit: handleTaskEdit,
  }), [projects, uid]);

  return (
    <div className="px-4 py-6 lg:px-8 max-w-3xl mx-auto space-y-4">

      {/* Dynamic Greeting */}
      <div>
        <h1 className="text-lg font-semibold text-text">
          {getGreeting(now.getHours())}, {user?.displayName?.split(' ')[0] || 'Ajmal'} 👋
        </h1>
        <p className="text-sm text-text-3 mt-0.5">
          {format(now, 'EEEE, MMMM d, yyyy')} | {format(now, 'hh:mm a')}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#111118] rounded-xl border border-border p-3 flex items-center gap-3 hover:border-[#FF993330] transition-colors">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 size={18} className="text-emerald-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-text leading-tight">{tasksCompletedToday}</p>
            <p className="text-xs text-text-3">Done today</p>
          </div>
        </div>
        <div className="bg-[#111118] rounded-xl border border-border p-3 flex items-center gap-3 hover:border-[#FF993330] transition-colors">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Target size={18} className="text-blue-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-text leading-tight">{activeGoals.length}</p>
            <p className="text-xs text-text-3">Active goals</p>
          </div>
        </div>
        <div className="bg-[#111118] rounded-xl border border-border p-3 flex items-center gap-3 hover:border-[#FF993330] transition-colors">
          <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <Flame size={18} className="text-orange-500" />
          </div>
          <div>
            <p className="text-lg font-bold text-text leading-tight">{avgStreak}d</p>
            <p className="text-xs text-text-3">Avg streak</p>
          </div>
        </div>
        <div className="bg-[#111118] rounded-xl border border-border p-3 flex items-center gap-3 hover:border-[#FF993330] transition-colors">
          <div className="w-9 h-9 rounded-lg bg-rise/10 flex items-center justify-center">
            <Wallet size={18} className="text-rise" />
          </div>
          <div>
            <p className={cn("text-lg font-bold leading-tight", monthlyBalance >= 0 ? "text-emerald-500" : "text-red-500")}>
              {formatCurrency(Math.abs(monthlyBalance))}
            </p>
            <p className="text-xs text-text-3">Monthly {monthlyBalance >= 0 ? 'surplus' : 'deficit'}</p>
          </div>
        </div>
      </div>

      {/* Winner's Mindset */}
      <div className="bg-[#111118] rounded-2xl border border-border overflow-hidden hover:border-[#FF993330] transition-colors">
        <button
          onClick={() => setAffirmationsOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3.5 text-left"
        >
          <div className="flex items-center gap-2">
            <span>✨</span>
            <span className="text-sm font-semibold text-text">Winner&apos;s Mindset</span>
          </div>
          {affirmationsOpen
            ? <ChevronUp size={16} className="text-text-3" />
            : <ChevronDown size={16} className="text-text-3" />}
        </button>
        {affirmationsOpen && (
          <div className="px-4 pb-4 space-y-2.5 border-t border-border pt-3">
            {SHUFFLED_AFFIRMATIONS.map((a, i) => (
              <div key={i} className="flex gap-2 text-sm text-text-2">
                <span className="text-rise shrink-0">•</span>
                <span>{a}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Today's Focus */}
      <div className="bg-[#111118] rounded-2xl border border-border p-4 hover:border-[#FF993330] transition-colors">
        <div className="flex items-center gap-2 mb-3">
          <span>🎯</span>
          <h2 className="text-sm font-semibold text-text">Today&apos;s Focus</h2>
          <span className="ml-auto text-xs text-text-3 bg-[#1A1A24] px-2 py-0.5 rounded-full">
            {focusTasks.length}/3
          </span>
        </div>
        {focusTasks.length === 0 ? (
          <p className="text-sm text-text-3 py-3 text-center">No focus tasks. Mark tasks as My Day.</p>
        ) : (
          <div className="space-y-2">
            {focusTasks.map(t => (
              <TaskCard key={t.id} task={t} {...sharedCardProps} />
            ))}
          </div>
        )}
      </div>

      {/* Next Up (Habits) */}
      <div className="bg-[#111118] rounded-2xl border border-border p-4 hover:border-[#FF993330] transition-colors">
        <div className="flex items-center gap-2 mb-2">
          <span>⏰</span>
          <h2 className="text-sm font-semibold text-text">Next Up</h2>
        </div>
        <div className="space-y-2">
          {(habits || [])
            .filter(h => {
              if (!h.isActive || !h.time) return false;
              const nowTime = format(now, 'HH:mm');
              if (h.time < nowTime) return false;
              const todayCount = h.completions?.[today] ?? 0;
              return todayCount < h.targetCount;
            })
            .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
            .slice(0, 3)
            .map(h => (
              <div key={h.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <span className="text-lg">{h.icon}</span>
                <span className="flex-1 text-sm text-text">{h.name}</span>
                <div className="flex items-center gap-1 text-xs text-text-3">
                  <Clock size={12} />
                  <span>{h.time}</span>
                </div>
              </div>
            ))}
        </div>
        {(habits || []).filter(h => h.isActive && h.time && h.time >= format(now, 'HH:mm') && (h.completions?.[today] ?? 0) < h.targetCount).length === 0 && (
          <p className="text-sm text-text-3 py-3 text-center">No habits scheduled for later today.</p>
        )}
      </div>

      {/* Get Things Done */}
      <div className="bg-[#111118] rounded-2xl border border-border p-4 hover:border-[#FF993330] transition-colors">
        <div className="flex items-center gap-2 mb-3">
          <span>⚡</span>
          <h2 className="text-sm font-semibold text-text">Get Things Done</h2>
        </div>
        {todayTasks.length === 0 ? (
          <p className="text-sm text-text-3 py-3 text-center">No tasks for today.</p>
        ) : (
          <div className="space-y-2">
            {todayTasks.map(t => (
              <TaskCard key={t.id} task={t} {...sharedCardProps} />
            ))}
          </div>
        )}
        <a
          href="/tasks"
          className="flex items-center justify-center gap-1 mt-3 pt-3 border-t border-border text-xs font-semibold text-rise hover:text-rise-dark transition-colors"
        >
          View all tasks →
        </a>
      </div>

      {/* Goal Progress */}
      {topGoals.length > 0 && (
        <div className="bg-[#111118] rounded-2xl border border-border p-4 hover:border-[#FF993330] transition-colors">
          <div className="flex items-center gap-2 mb-3">
            <Target size={16} className="text-blue-500" />
            <h2 className="text-sm font-semibold text-text">Goal Progress</h2>
          </div>
          <div className="space-y-3">
            {topGoals.map(g => (
              <div key={g.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text truncate mr-2">{g.title}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-medium text-text-3 bg-[#1A1A24] px-1.5 py-0.5 rounded">
                      {g.area}
                    </span>
                    <span className="text-xs font-semibold text-text-2">{g.progress}%</span>
                  </div>
                </div>
                <div className="w-full h-1.5 bg-[#1A1A24] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${Math.min(g.progress, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <a
            href="/goals"
            className="flex items-center justify-center gap-1 mt-3 pt-3 border-t border-border text-xs font-semibold text-rise hover:text-rise-dark transition-colors"
          >
            View all goals →
          </a>
        </div>
      )}

    </div>
  );
}
