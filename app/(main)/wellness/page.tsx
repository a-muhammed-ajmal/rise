'use client';

import { useState, useEffect } from 'react';
import {
  Plus, Flame, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Timer, Activity, Settings, Play, Pause, RotateCcw, SkipForward,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { updateDocById, createDoc } from '@/lib/firestore';
import { COLLECTIONS, RHYTHM_CATEGORIES, HABIT_PROJECTS } from '@/lib/constants';
import { todayISO, cn } from '@/lib/utils';
import type { Habit, HabitStatus, HabitFrequency, HabitProject } from '@/lib/types';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/lib/toast';
import { sanitize } from '@/lib/sanitizer';
import { usePomodoroTimer } from '@/hooks/usePomodoroTimer';

// ─── RHYTHM MODAL ─────────────────────────────────────────────────────────────
interface RhythmForm {
  name: string;
  icon: string;
  color: string;
  category: string;
  project: HabitProject;
  frequency: HabitFrequency;
  customDays: number[];
  targetCount: number;
  time: string;
  reminderEnabled: boolean;
  reminderTime: string;
  trigger: string;
  note: string;
}

const DEFAULT_RHYTHM: RhythmForm = {
  name: '',
  icon: '💪',
  color: '#FF6B35',
  category: 'Fitness',
  project: 'Morning Routine',
  frequency: 'daily',
  customDays: [],
  targetCount: 1,
  time: '',
  reminderEnabled: false,
  reminderTime: '08:00',
  trigger: '',
  note: '',
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function RhythmModal({
  open,
  onClose,
  habit,
  userId,
}: {
  open: boolean;
  onClose: () => void;
  habit: Habit | null;
  userId: string;
}) {
  const [form, setForm] = useState<RhythmForm>(
    habit
      ? {
          name: habit.name,
          icon: habit.icon,
          color: habit.color,
          category: habit.category,
          project: habit.project,
          frequency: habit.frequency,
          customDays: habit.customDays ?? [],
          targetCount: habit.targetCount,
          time: habit.time ?? '',
          reminderEnabled: habit.reminder.enabled,
          reminderTime: habit.reminder.time,
          trigger: habit.trigger ?? '',
          note: habit.note ?? '',
        }
      : { ...DEFAULT_RHYTHM }
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof RhythmForm>(k: K, v: RhythmForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setErrors({ name: 'Name is required' }); return; }
    setSaving(true);
    try {
      const data = {
        userId,
        name: sanitize(form.name, 100),
        icon: form.icon || '💪',
        color: form.color,
        category: form.category,
        project: form.project,
        frequency: form.frequency,
        customDays: form.frequency === 'weekly' ? form.customDays : undefined,
        targetCount: form.targetCount,
        time: form.time || undefined,
        reminder: { enabled: form.reminderEnabled, time: form.reminderTime },
        trigger: sanitize(form.trigger),
        note: sanitize(form.note),
        completions: habit?.completions ?? {},
        statusLog: habit?.statusLog ?? {},
        streak: habit?.streak ?? 0,
        bestStreak: habit?.bestStreak ?? 0,
        isActive: true,
        order: habit?.order ?? Date.now(),
      };
      if (habit) await updateDocById(COLLECTIONS.HABITS, habit.id, data);
      else await createDoc(COLLECTIONS.HABITS, data);
      toast.success('Rhythm saved.');
      onClose();
    } catch {
      toast.error('Failed to save rhythm.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={habit ? 'Edit Rhythm' : 'New Rhythm'}
      footer={
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
          <Button fullWidth loading={saving} onClick={handleSave}>Save</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-3">
          <Input
            label="Icon"
            value={form.icon}
            onChange={(e) => set('icon', e.target.value)}
            className="w-20 text-center text-lg"
            placeholder="💪"
          />
          <div className="flex-1">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              error={errors.name}
              required
              placeholder="e.g. Morning Run"
            />
          </div>
        </div>
        <Select
          label="Category"
          value={form.category}
          onChange={(e) => set('category', (e.target as HTMLSelectElement).value)}
          options={RHYTHM_CATEGORIES.map((c) => ({ value: c, label: c }))}
        />
        <Select
          label="Group"
          value={form.project}
          onChange={(e) => set('project', (e.target as HTMLSelectElement).value as HabitProject)}
          options={HABIT_PROJECTS.map((p) => ({ value: p, label: p }))}
        />
        <Select
          label="Frequency"
          value={form.frequency}
          onChange={(e) => set('frequency', (e.target as HTMLSelectElement).value as HabitFrequency)}
          options={[
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'yearly', label: 'Yearly' },
          ]}
        />
        {form.frequency === 'weekly' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#F0F0F0]">Days</label>
            <div className="flex gap-2">
              {DAY_LABELS.map((day, idx) => {
                const num = idx + 1;
                const selected = form.customDays.includes(num);
                return (
                  <button
                    key={day}
                    onClick={() =>
                      set('customDays', selected
                        ? form.customDays.filter((d) => d !== num)
                        : [...form.customDays, num]
                      )
                    }
                    className={cn(
                      'w-9 h-9 rounded-full text-xs font-medium transition-colors',
                      selected ? 'bg-[#FF6B35] text-white' : 'bg-[#1C1C1C] text-[#8A8A8A] border border-[#2A2A2A]'
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <Input
          label="Scheduled Time (optional)"
          type="time"
          value={form.time}
          onChange={(e) => set('time', e.target.value)}
        />
        <Input
          label="Trigger / Cue"
          value={form.trigger}
          onChange={(e) => set('trigger', e.target.value)}
          placeholder="e.g. After morning coffee"
        />
        <Textarea
          label="Note"
          value={form.note}
          onChange={(e) => set('note', e.target.value)}
          rows={2}
          placeholder="Any notes..."
        />
      </div>
    </Modal>
  );
}

// ─── POMODORO TIMER PANEL ─────────────────────────────────────────────────────
function PomodoroPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const {
    sessionType, display, isRunning, sessionsCompleted,
    start, pause, reset, skip,
  } = usePomodoroTimer(userId);

  const labels = { work: 'Focus', 'short-break': 'Short Break', 'long-break': 'Long Break' };
  const colors = { work: '#FF6B35', 'short-break': '#1ABC9C', 'long-break': '#1E4AFF' };

  return (
    <div className="fixed bottom-[72px] right-4 z-50 sm:bottom-6 sm:right-6 bg-[#141414] border border-[#2A2A2A] rounded-card p-4 w-56 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold" style={{ color: colors[sessionType] }}>
          {labels[sessionType]}
        </span>
        <button onClick={onClose} className="text-[#8A8A8A] text-xs">✕</button>
      </div>
      <div className="text-center mb-4">
        <span className="text-4xl font-bold text-[#F0F0F0] tabular-nums">{display}</span>
        <p className="text-xs text-[#8A8A8A] mt-1">Session {sessionsCompleted + 1}</p>
      </div>
      <div className="flex gap-2 justify-center">
        <button
          onClick={isRunning ? pause : start}
          className="w-10 h-10 rounded-full bg-[#FF6B35] flex items-center justify-center"
        >
          {isRunning ? <Pause size={16} className="text-white" /> : <Play size={16} className="text-white" />}
        </button>
        <button
          onClick={reset}
          className="w-10 h-10 rounded-full bg-[#1C1C1C] border border-[#2A2A2A] flex items-center justify-center text-[#8A8A8A]"
        >
          <RotateCcw size={14} />
        </button>
        <button
          onClick={skip}
          className="w-10 h-10 rounded-full bg-[#1C1C1C] border border-[#2A2A2A] flex items-center justify-center text-[#8A8A8A]"
        >
          <SkipForward size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── RHYTHM CARD ──────────────────────────────────────────────────────────────
function RhythmCard({
  habit,
  selectedDate,
  onEdit,
}: {
  habit: Habit;
  selectedDate: string;
  onEdit: (h: Habit) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = habit.statusLog[selectedDate];

  const markDone = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const completions = { ...habit.completions, [selectedDate]: (habit.completions[selectedDate] ?? 0) + 1 };
    const statusLog = { ...habit.statusLog, [selectedDate]: 'done' as HabitStatus };
    const streak = status !== 'done' ? habit.streak + 1 : habit.streak;
    await updateDocById(COLLECTIONS.HABITS, habit.id, { completions, statusLog, streak });
    toast.success(`${habit.name} ✓`);
  };

  const markFailed = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const statusLog = { ...habit.statusLog, [selectedDate]: 'failed' as HabitStatus };
    const completions = { ...habit.completions };
    delete completions[selectedDate];
    await updateDocById(COLLECTIONS.HABITS, habit.id, { statusLog, completions });
  };

  // Last 7 days status strip
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const statusColors: Record<HabitStatus, string> = {
    done: '#1ABC9C',
    failed: '#FF4F6D',
    pending: '#2A2A2A',
  };

  return (
    <div
      className="bg-[#141414] rounded-card border border-[#2A2A2A] p-4 flex flex-col gap-3"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{habit.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#F0F0F0]">{habit.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge label={habit.category} />
            <span className="text-xs text-[#FF6B35] flex items-center gap-0.5">
              <Flame size={10} /> {habit.streak}
            </span>
          </div>
        </div>
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          {status !== 'done' && (
            <button
              onClick={markDone}
              className="h-10 px-3 rounded-button bg-[#1ABC9C]/15 text-[#1ABC9C] text-xs font-semibold min-w-[56px]"
            >
              Done
            </button>
          )}
          {status === 'done' && (
            <span className="h-10 px-3 flex items-center text-xs text-[#1ABC9C] font-semibold">
              ✓ Done
            </span>
          )}
          {status !== 'failed' && status !== 'done' && (
            <button
              onClick={markFailed}
              className="h-10 px-3 rounded-button bg-[#FF4F6D]/15 text-[#FF4F6D] text-xs font-semibold min-w-[56px]"
            >
              Skip
            </button>
          )}
        </div>
        {expanded
          ? <ChevronUp size={16} className="text-[#8A8A8A] flex-shrink-0" />
          : <ChevronDown size={16} className="text-[#8A8A8A] flex-shrink-0" />
        }
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 pt-2 border-t border-[#2A2A2A]">
          {/* 7-day strip */}
          <div className="flex gap-1.5">
            {last7.map((date) => {
              const s = habit.statusLog[date] as HabitStatus | undefined;
              return (
                <div
                  key={date}
                  className="flex-1 h-2 rounded-full"
                  style={{ backgroundColor: s ? statusColors[s] : statusColors.pending }}
                  title={date}
                />
              );
            })}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(habit); }}
            className="text-xs text-[#FF6B35] text-left"
          >
            Edit Rhythm
          </button>
        </div>
      )}
    </div>
  );
}

// ─── WELLNESS PAGE ────────────────────────────────────────────────────────────
export default function WellnessPage() {
  const { user } = useAuth();
  const { data: habits, loading } = useCollection<Habit>({
    userId: user?.uid ?? '',
    collectionName: COLLECTIONS.HABITS,
    enabled: !!user,
  });

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [activeGroup, setActiveGroup] = useState<string>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editHabit, setEditHabit] = useState<Habit | null>(null);
  const [pomodoroOpen, setPomodoroOpen] = useState(false);

  // 7-day strip
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const dayNames = ['S','M','T','W','T','F','S'];

  // Filter by group
  const groups = ['All', ...HABIT_PROJECTS];
  const displayed = habits.filter((h) =>
    h.isActive && (activeGroup === 'All' || h.project === activeGroup)
  );

  // Status counts for selected date
  const done = habits.filter((h) => h.statusLog[selectedDate] === 'done').length;
  const failed = habits.filter((h) => h.statusLog[selectedDate] === 'failed').length;
  const pending = habits.filter((h) => h.isActive && !h.statusLog[selectedDate]).length;
  const totalActive = habits.filter((h) => h.isActive).length;
  const pct = totalActive > 0 ? Math.round((done / totalActive) * 100) : 0;

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#2A2A2A]">
        <h1 className="text-xl font-bold text-[#F0F0F0] mb-3">Wellness</h1>

        {/* 7-day date strip */}
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
          {days.map((date, idx) => {
            const d = new Date(date + 'T00:00:00');
            const isToday = date === todayISO();
            const isSelected = date === selectedDate;
            return (
              <button
                key={date}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  'flex-shrink-0 flex flex-col items-center gap-1 w-10 py-2 rounded-card transition-colors',
                  isSelected ? 'bg-[#FF6B35]' : isToday ? 'bg-[#1C1C1C]' : 'bg-transparent'
                )}
              >
                <span className={cn('text-[10px]', isSelected ? 'text-white' : 'text-[#8A8A8A]')}>
                  {dayNames[d.getDay()]}
                </span>
                <span className={cn('text-sm font-semibold', isSelected ? 'text-white' : 'text-[#F0F0F0]')}>
                  {d.getDate()}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-4 mt-3">
          <span className="text-xs text-[#1ABC9C]">Done: {done}</span>
          <span className="text-xs text-[#8A8A8A]">Pending: {pending}</span>
          <span className="text-xs text-[#FF4F6D]">Failed: {failed}</span>
          <span className="text-xs text-[#FF6B35] ml-auto font-semibold">{pct}%</span>
        </div>
      </div>

      {/* Group tabs */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3 border-b border-[#2A2A2A]">
        {groups.map((g) => (
          <button
            key={g}
            onClick={() => setActiveGroup(g)}
            className={cn(
              'flex-shrink-0 h-7 px-3 rounded-chip text-xs font-medium transition-colors',
              activeGroup === g
                ? 'bg-[#FF6B35] text-white'
                : 'bg-[#141414] text-[#8A8A8A] border border-[#2A2A2A]'
            )}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Rhythm list */}
      <div className="flex-1 px-4 py-4 pb-6 flex flex-col gap-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : displayed.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No rhythms yet"
            subtitle="Build your first daily rhythm to track habits consistently."
            actionLabel="Add Rhythm"
            onAction={() => { setEditHabit(null); setModalOpen(true); }}
          />
        ) : (
          displayed.map((habit) => (
            <RhythmCard
              key={habit.id}
              habit={habit}
              selectedDate={selectedDate}
              onEdit={(h) => { setEditHabit(h); setModalOpen(true); }}
            />
          ))
        )}
      </div>

      {/* FAB */}
      <button
        onClick={() => { setEditHabit(null); setModalOpen(true); }}
        className="fixed bottom-[80px] right-4 w-14 h-14 bg-[#1ABC9C] rounded-full flex items-center justify-center shadow-fab active:scale-95 transition-transform sm:hidden z-30"
        aria-label="Add rhythm"
      >
        <Plus size={24} className="text-white" />
      </button>

      {/* Pomodoro button */}
      <button
        onClick={() => setPomodoroOpen(!pomodoroOpen)}
        className="fixed bottom-[144px] right-4 w-12 h-12 bg-[#141414] border border-[#2A2A2A] rounded-full flex items-center justify-center shadow-card sm:hidden z-30"
        aria-label="Pomodoro timer"
      >
        <Timer size={20} className="text-[#FF6B35]" />
      </button>

      {pomodoroOpen && user && (
        <PomodoroPanel userId={user.uid} onClose={() => setPomodoroOpen(false)} />
      )}

      <RhythmModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        habit={editHabit}
        userId={user?.uid ?? ''}
      />
    </div>
  );
}
