'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import {
  ChevronDown, ChevronUp, ArrowRight,
  Circle, Sun, Check, Activity, CheckSquare, Eye,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { updateDocById } from '@/lib/firestore';
import { COLLECTIONS } from '@/lib/constants';
import { cn, formatTime, todayISO } from '@/lib/utils';
import type { Task, Habit, Project, Goal, HabitStatus } from '@/lib/types';
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

// ─── SECTION CARD WRAPPER ─────────────────────────────────────────────────────

function SectionCard({
  icon: Icon,
  title,
  linkHref,
  linkLabel,
  children,
}: {
  icon: React.ElementType;
  title: string;
  linkHref?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-[#E5E5EA] shadow-sm">
      {/* Card header — title and optional "See all" in one unified bar */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#E5E5EA]">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#FF9933]/12 flex items-center justify-center flex-shrink-0">
            <Icon size={15} className="text-[#FF9933]" />
          </div>
          <h2 className="text-[15px] font-semibold text-[#1C1C1E]">{title}</h2>
        </div>
        {linkHref && linkLabel ? (
          <a
            href={linkHref}
            className="flex items-center gap-1 text-[13px] font-medium text-[#FF9933]"
          >
            {linkLabel}
            <ArrowRight size={13} />
          </a>
        ) : null}
      </div>
      {/* Card body */}
      {children}
    </div>
  );
}

// ─── SECTION: TODAY'S FOCUS ───────────────────────────────────────────────────

function TodayFocus({
  tasks,
  projects,
  onComplete,
  onEdit,
}: {
  tasks: Task[];
  projects: Project[];
  onComplete: (t: Task) => void;
  onEdit: (t: Task) => void;
}) {
  const focusTasks = tasks
    .filter((t) => t.isMyDay && !t.isCompleted)
    .sort((a, b) => a.order - b.order)
    .slice(0, 3);

  return (
    <SectionCard icon={Sun} title="Today's Focus">
      {focusTasks.length === 0 ? (
        <div className="px-4 py-8 flex flex-col items-center gap-2 text-center">
          <Sun size={28} className="text-[#AEAEB2]" />
          <p className="text-sm text-[#6C6C70]">No focus actions. Mark actions as My Day.</p>
        </div>
      ) : (
        <div>
          {focusTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              projects={projects}
              onComplete={onComplete}
              onEdit={onEdit}
              selected={false}
              onSelect={() => { }}
              inBulkMode={false}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ─── SECTION: BE CONSISTENT ───────────────────────────────────────────────────

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
    <SectionCard icon={Activity} title="Be Consistent" linkHref="/wellness" linkLabel="See all">
      {allDoneOrFailed ? (
        <div className="px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#1ABC9C]/12 flex items-center justify-center flex-shrink-0">
            <Check size={16} className="text-[#1ABC9C]" />
          </div>
          <p className="text-sm text-[#1ABC9C] font-medium">All rhythms completed for today!</p>
        </div>
      ) : pendingHabits.length === 0 ? (
        <div className="px-4 py-8 flex items-center justify-center">
          <p className="text-sm text-[#6C6C70]">No active rhythms.</p>
        </div>
      ) : (
        <div>
          {visible.map((habit, idx) => (
            <div
              key={habit.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3',
                idx < visible.length - 1 && 'border-b border-[#E5E5EA]'
              )}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#1C1C1E] truncate font-medium">{habit.name}</p>
                {habit.time && (
                  <p className="text-xs text-[#6C6C70] mt-0.5">{formatTime(habit.time)}</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => markDone(habit)}
                  className="h-10 px-3.5 rounded-lg bg-[#1ABC9C]/10 text-[#1ABC9C] text-xs font-semibold active:bg-[#1ABC9C]/20 border border-[#1ABC9C]/20 transition-colors"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => markFailed(habit)}
                  className="h-10 px-3.5 rounded-lg bg-[#FF4F6D]/10 text-[#FF4F6D] text-xs font-semibold active:bg-[#FF4F6D]/20 border border-[#FF4F6D]/20 transition-colors"
                >
                  Fail
                </button>
              </div>
            </div>
          ))}

          {!expanded && remaining > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="w-full flex items-center justify-center gap-1.5 py-3 text-xs text-[#FF9933] font-medium border-t border-[#E5E5EA]"
            >
              <ChevronDown size={14} />
              Show {remaining} more
            </button>
          )}
          {expanded && pendingHabits.length > 5 && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="w-full flex items-center justify-center gap-1.5 py-3 text-xs text-[#6C6C70] border-t border-[#E5E5EA]"
            >
              <ChevronUp size={14} />
              Show less
            </button>
          )}
        </div>
      )}
    </SectionCard>
  );
}

// ─── VISION CATEGORY COLORS ───────────────────────────────────────────────────
const VISION_CATEGORY_COLORS: Record<string, string> = {
  Personal: '#800080',
  Professional: '#1E4AFF',
  Financial: '#00A86B',
  Relationships: '#FF4F6D',
  Health: '#1ABC9C',
  Learning: '#FFD700',
};

// ─── SECTION: TARGET PROGRESS ─────────────────────────────────────────────────

function TargetProgress({ goals }: { goals: Goal[] }) {
  const activeGoals = goals
    .filter((g) => !g.isCompleted)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 3);

  if (activeGoals.length === 0) return null;

  return (
    <SectionCard icon={Eye} title="Target Progress" linkHref="/goals" linkLabel="See all">
      <div>
        {activeGoals.map((goal, idx) => {
          const color = VISION_CATEGORY_COLORS[goal.category] ?? '#FF9933';
          return (
            <div
              key={goal.id}
              className={`px-4 py-3 ${idx < activeGoals.length - 1 ? 'border-b border-[#E5E5EA]' : ''}`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-medium text-[#1C1C1E] truncate flex-1 pr-2">{goal.title}</p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: color + '18', color }}
                  >
                    {goal.category}
                  </span>
                  <span className="text-xs font-semibold text-[#1C1C1E]">{goal.progress}%</span>
                </div>
              </div>
              <div className="h-1.5 bg-[#E5E5EA] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${goal.progress}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

function GetThingsDone({
  tasks,
  projects,
  onComplete,
  onEdit,
  onSeeAll,
}: {
  tasks: Task[];
  projects: Project[];
  onComplete: (t: Task) => void;
  onEdit: (t: Task) => void;
  onSeeAll: () => void;
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
    <SectionCard icon={CheckSquare} title="Get Things Done">
      {todayTasks.length === 0 ? (
        <div className="px-4 py-8 flex flex-col items-center gap-2 text-center">
          <Circle size={28} className="text-[#AEAEB2]" />
          <p className="text-sm text-[#6C6C70]">No actions for today. You&apos;re all clear!</p>
        </div>
      ) : (
        <div>
          {todayTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              projects={projects}
              onComplete={onComplete}
              onEdit={onEdit}
              selected={false}
              onSelect={() => { }}
              inBulkMode={false}
            />
          ))}
        </div>
      )}
      <div className="border-t border-[#E5E5EA] px-4 py-3">
        <button
          type="button"
          onClick={onSeeAll}
          className="w-full flex items-center justify-center gap-1.5 text-[13px] font-medium text-[#FF9933]"
        >
          See all
          <ArrowRight size={13} />
        </button>
      </div>
    </SectionCard>
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
  const { data: goals } = useCollection<Goal>({
    userId: user?.uid ?? '',
    collectionName: COLLECTIONS.GOALS,
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
    toast.success('Action completed!');
  }, []);

  const handleEdit = useCallback((task: Task) => {
    router.push(`/tasks?detail=${task.id}`);
  }, [router]);

  return (
    <div className="page-content flex flex-col gap-4 pb-6">

      {/* ── Greeting card ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl px-4 py-4 border border-[#E5E5EA] shadow-sm">
        <h1 className="text-[17px] font-semibold text-[#1C1C1E] leading-tight">{greeting}</h1>
        <p className="text-[13px] text-[#6C6C70] mt-0.5">{dateTime}</p>
      </div>

      {/* ── Today's Focus ─────────────────────────────────────────────────── */}
      <TodayFocus
        tasks={tasks}
        projects={projects}
        onComplete={handleComplete}
        onEdit={handleEdit}
      />

      {/* ── Be Consistent ─────────────────────────────────────────────────── */}
      <BeConsistent habits={habits} />

      {/* ── Get Things Done ───────────────────────────────────────────────── */}
      <GetThingsDone
        tasks={tasks}
        projects={projects}
        onComplete={handleComplete}
        onEdit={handleEdit}
        onSeeAll={() => router.push('/tasks')}
      />

      {/* ── Target Progress ───────────────────────────────────────────────── */}
      <TargetProgress goals={goals} />


    </div>
  );
}
