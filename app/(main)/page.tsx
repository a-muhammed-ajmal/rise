'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  ChevronDown, ChevronUp, ArrowRight,
  CheckCircle2, Circle, Sun, Check,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { updateDocById, deleteDocById, createDoc } from '@/lib/firestore';
import { COLLECTIONS } from '@/lib/constants';
import { cn, formatTime, todayISO } from '@/lib/utils';
import type { Task, Habit, Project, HabitStatus } from '@/lib/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { TaskCard } from '@/components/tasks/TaskCard';
import { toast } from '@/lib/toast';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatGreetingClock(): string {
  const now = new Date();
  const datePart = format(now, 'EEEE, MMM dd, yyyy');
  const timePart = format(now, 'h:mm a');
  return `${datePart} · ${timePart}`;
}

function getGreeting(hour: number, surname: string): string {
  const n = surname ? `, ${surname}` : '';
  if (hour >= 5 && hour <= 11) return `Good morning${n}`;
  if (hour >= 12 && hour <= 16) return `Good afternoon${n}`;
  if (hour >= 1 && hour <= 4) return `Up late${n}`;
  return `Good evening${n}`;
}

function recalcStreak(statusLog: Record<string, HabitStatus>): number {
  let streak = 0;
  const base = new Date();
  for (let i = 0; i < 366; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    if (statusLog[dateStr] !== 'done') break;
    streak++;
  }
  return streak;
}

// ─── SECTION 3: TODAY'S FOCUS ─────────────────────────────────────────────────

function TodayFocus({
  tasks,
  projects,
  onComplete,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  tasks: Task[];
  projects: Project[];
  onComplete: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onDuplicate: (t: Task) => void;
}) {
  const focusTasks = tasks
    .filter((t) => t.isMyDay && !t.isCompleted)
    .sort((a, b) => a.order - b.order)
    .slice(0, 3);

  return (
    <div>
      <p className="section-label mb-3">Today&apos;s Focus</p>
      {focusTasks.length === 0 ? (
        <div className="glass-card p-5 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-center">
            <Sun size={28} className="text-[#505050]" />
            <p className="text-sm text-[#8A8A8A]">No focus actions. Mark actions as My Day.</p>
          </div>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {focusTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              projects={projects}
              onComplete={onComplete}
              onEdit={onEdit}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              selected={false}
              onSelect={() => {}}
              inBulkMode={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── SECTION 4: BE CONSISTENT ─────────────────────────────────────────────────

function BeConsistent({ habits }: { habits: Habit[] }) {
  const [expanded, setExpanded] = useState(false);
  const todayKey = todayISO();

  const pendingHabits = habits
    .filter((h) => h.isActive)
    .filter((h) => {
      const status = h.statusLog[todayKey];
      return status !== 'done' && status !== 'failed';
    })
    .sort((a, b) => {
      const aTime = a.time ?? '';
      const bTime = b.time ?? '';
      if (!aTime && bTime) return 1;
      if (aTime && !bTime) return -1;
      if (!aTime && !bTime) return a.name.localeCompare(b.name);
      if (aTime !== bTime) return aTime.localeCompare(bTime);
      return a.name.localeCompare(b.name);
    });

  const remaining = pendingHabits.length - 5;
  const visible = expanded ? pendingHabits : pendingHabits.slice(0, 5);
  const allDoneOrFailed =
    habits.filter((h) => h.isActive).length > 0 && pendingHabits.length === 0;

  const markDone = async (habit: Habit) => {
    const newStatusLog = { ...habit.statusLog, [todayKey]: 'done' as HabitStatus };
    const newCompletions = { ...habit.completions, [todayKey]: 1 };
    const newStreak = recalcStreak(newStatusLog);
    const newBestStreak = Math.max(habit.bestStreak ?? 0, newStreak);
    try {
      await updateDocById(COLLECTIONS.HABITS, habit.id, {
        statusLog: newStatusLog,
        completions: newCompletions,
        streak: newStreak,
        bestStreak: newBestStreak,
      });
    } catch {
      toast.error('Failed to update rhythm.');
    }
  };

  const markFailed = async (habit: Habit) => {
    const newStatusLog = { ...habit.statusLog, [todayKey]: 'failed' as HabitStatus };
    const newCompletions = { ...habit.completions };
    delete newCompletions[todayKey];
    const newStreak = recalcStreak(newStatusLog);
    try {
      await updateDocById(COLLECTIONS.HABITS, habit.id, {
        statusLog: newStatusLog,
        completions: newCompletions,
        streak: newStreak,
      });
    } catch {
      toast.error('Failed to update rhythm.');
    }
  };

  return (
    <div>
      <p className="section-label mb-3">Be Consistent</p>
      {allDoneOrFailed ? (
        <div className="glass-card p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#1ABC9C]/15 flex items-center justify-center flex-shrink-0">
            <Check size={16} className="text-[#1ABC9C]" />
          </div>
          <p className="text-sm text-[#1ABC9C] font-medium">All rhythms completed for today!</p>
        </div>
      ) : pendingHabits.length === 0 ? (
        <div className="glass-card p-5 flex items-center justify-center">
          <p className="text-sm text-[#8A8A8A]">No active rhythms.</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {visible.map((habit, idx) => (
            <div
              key={habit.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3',
                idx < visible.length - 1 && 'border-b border-[#2A2A2A]'
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#F0F0F0] truncate">{habit.name}</p>
                {habit.time && (
                  <p className="text-xs text-[#8A8A8A] mt-0.5">{formatTime(habit.time)}</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => markDone(habit)}
                  className="h-8 px-3 rounded-button bg-[#1ABC9C]/15 text-[#1ABC9C] text-xs font-semibold active:bg-[#1ABC9C]/25"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => markFailed(habit)}
                  className="h-8 px-3 rounded-button bg-[#FF4F6D]/15 text-[#FF4F6D] text-xs font-semibold active:bg-[#FF4F6D]/25"
                >
                  Failed
                </button>
              </div>
            </div>
          ))}

          {!expanded && remaining > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="w-full flex items-center justify-center gap-1.5 py-3 text-xs text-[#FF6B35] border-t border-[#2A2A2A]"
            >
              <ChevronDown size={14} />
              Show {remaining} more
            </button>
          )}
          {expanded && pendingHabits.length > 5 && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="w-full flex items-center justify-center gap-1.5 py-3 text-xs text-[#8A8A8A] border-t border-[#2A2A2A]"
            >
              <ChevronUp size={14} />
              Show less
            </button>
          )}
        </div>
      )}

      <a
        href="/wellness"
        className="flex items-center gap-1.5 mt-3 text-xs text-[#FF6B35]"
      >
        View all rhythms <ArrowRight size={12} />
      </a>
    </div>
  );
}

// ─── SECTION 5: GET THINGS DONE ───────────────────────────────────────────────

function GetThingsDone({
  tasks,
  projects,
  onComplete,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  tasks: Task[];
  projects: Project[];
  onComplete: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onDuplicate: (t: Task) => void;
}) {
  const todayKey = todayISO();

  const todayTasks = tasks
    .filter((t) => !t.isCompleted && (t.isMyDay || t.dueDate === todayKey))
    .sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return Number(a.isCompleted) - Number(b.isCompleted);
      return a.order - b.order;
    })
    .slice(0, 5);

  return (
    <div>
      <p className="section-label mb-3">Get Things Done</p>
      {todayTasks.length === 0 ? (
        <div className="glass-card p-5 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-center">
            <Circle size={28} className="text-[#505050]" />
            <p className="text-sm text-[#8A8A8A]">No actions for today. You&apos;re all clear!</p>
          </div>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          {todayTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              projects={projects}
              onComplete={onComplete}
              onEdit={onEdit}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              selected={false}
              onSelect={() => {}}
              inBulkMode={false}
            />
          ))}
        </div>
      )}
      <a
        href="/tasks"
        className="flex items-center gap-1.5 mt-3 text-xs text-[#FF6B35]"
      >
        View all actions <ArrowRight size={12} />
      </a>
    </div>
  );
}

// ─── DASHBOARD PAGE ───────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [dateTime, setDateTime] = useState(formatGreetingClock);

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
  const { data: projects } = useCollection<Project>({
    userId: user?.uid ?? '',
    collectionName: COLLECTIONS.PROJECTS,
    enabled: !!user,
  });

  // Live clock — update every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => setDateTime(formatGreetingClock()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Greeting logic: surname = last word of displayName
  const surname = user?.displayName
    ? (user.displayName.split(' ').filter(Boolean).pop() ?? '')
    : '';
  const greeting = getGreeting(new Date().getHours(), surname);

  // ── Shared task action handlers ────────────────────────────────────────────

  const handleComplete = useCallback(async (task: Task) => {
    await updateDocById(COLLECTIONS.TASKS, task.id, {
      isCompleted: true,
      completedAt: new Date().toISOString(),
    });
    toast.success('Action completed! 🎉');
  }, []);

  const handleEdit = useCallback((task: Task) => {
    router.push('/tasks');
  }, [router]);

  const handleDelete = useCallback(async (task: Task) => {
    await deleteDocById(COLLECTIONS.TASKS, task.id);
    toast.success('Action deleted.');
  }, []);

  const handleDuplicate = useCallback(async (task: Task) => {
    const { id, ...rest } = task;
    await createDoc(COLLECTIONS.TASKS, {
      ...rest,
      title: task.title + ' (copy)',
      order: Date.now(),
      isCompleted: false,
      completedAt: undefined,
    });
    toast.success('Action duplicated.');
  }, []);

  return (
    <div className="page-content flex flex-col gap-6 pb-6">

      {/* ── Section 1: Dynamic Greeting ──────────────────────────────────────── */}
      <div className="pt-2">
        <h1 className="text-xl font-bold text-[#F0F0F0]">{greeting}</h1>
        <p className="text-xs text-[#8A8A8A] mt-0.5">{dateTime}</p>
      </div>

      {/* ── Section 3: Today's Focus ──────────────────────────────────────────── */}
      <TodayFocus
        tasks={tasks}
        projects={projects}
        onComplete={handleComplete}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
      />

      {/* ── Section 4: Be Consistent ─────────────────────────────────────────── */}
      <BeConsistent habits={habits} />

      {/* ── Section 5: Get Things Done ───────────────────────────────────────── */}
      <GetThingsDone
        tasks={tasks}
        projects={projects}
        onComplete={handleComplete}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
      />

    </div>
  );
}
