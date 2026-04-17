'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Plus, Clock, Flame, Trophy, CheckCircle, XCircle,
  Activity, Timer, Pencil, Copy, Trash2,
  Play, Pause, RotateCcw, SkipForward, Settings,
  ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCollection } from '@/hooks/useFirestore';
import { updateDocById, createDoc, deleteDocById } from '@/lib/firestore';
import { COLLECTIONS, RHYTHM_CATEGORIES, RHYTHM_COLORS, AFFIRMATIONS } from '@/lib/constants';
import { todayISO, cn } from '@/lib/utils';
import type { Habit, HabitStatus, HabitFrequency } from '@/lib/types';
import { SkeletonCard } from '@/components/ui/SkeletonCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Modal, ConfirmModal } from '@/components/ui/Modal';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from '@/lib/toast';
import { sanitize } from '@/lib/sanitizer';
import { usePomodoroTimer } from '@/hooks/usePomodoroTimer';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** Convert HH:mm to 12-hour AM/PM string */
function formatTime12(time24: string): string {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Calculate streak: consecutive days ending on today or yesterday with status === 'done' */
function calculateStreak(statusLog: Record<string, HabitStatus>): number {
  const today = todayISO();
  const yesterday = (() => {
    const d = new Date(today + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  })();

  const startDate = statusLog[today] === 'done' ? today : yesterday;
  if (statusLog[startDate] !== 'done') return 0;

  let streak = 0;
  let checkDate = startDate;
  while (statusLog[checkDate] === 'done') {
    streak++;
    const d = new Date(checkDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    checkDate = d.toISOString().split('T')[0];
  }
  return streak;
}

// ─── WINNER'S MINDSET COMPONENT ──────────────────────────────────────────────

function WinnersMindset() {
  const [expanded, setExpanded] = useState(false);
  // Shuffle once on mount
  const shuffled = useState<string[]>(() =>
    [...AFFIRMATIONS].sort(() => Math.random() - 0.5)
  )[0];

  return (
    <div className="mx-4 mt-4 bg-white rounded-2xl border border-[#E5E5EA] overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center justify-between px-4 py-3.5"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#FFD700]/12 flex items-center justify-center flex-shrink-0">
            <Sparkles size={15} className="text-[#FFD700]" />
          </div>
          <span className="text-[15px] font-semibold text-[#1C1C1E]">Winner&apos;s Mindset</span>
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-[#AEAEB2]" />
        ) : (
          <ChevronDown size={16} className="text-[#AEAEB2]" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-[#E5E5EA] px-4 py-3 flex flex-col gap-2.5">
          {shuffled.map((affirmation, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 w-4 h-4 flex-shrink-0 rounded-full bg-[#FFD700]/15 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700]" />
              </span>
              <p className="text-sm text-[#1C1C1E] leading-relaxed">{affirmation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Category colour map (cycling through RHYTHM_COLORS) */
const CATEGORY_COLORS: Record<string, string> = {};
RHYTHM_CATEGORIES.forEach((cat, i) => {
  CATEGORY_COLORS[cat] = RHYTHM_COLORS[i % RHYTHM_COLORS.length];
});

// ─── RHYTHM FORM / MODAL ──────────────────────────────────────────────────────

interface RhythmFormData {
  name: string;
  note: string;
  category: string;
  time: string;
  frequency: HabitFrequency;
  reminderEnabled: boolean;
}

const EMPTY_FORM: RhythmFormData = {
  name: '',
  note: '',
  category: 'Fitness',
  time: '',
  frequency: 'daily',
  reminderEnabled: false,
};

function RhythmFormFields({
  form,
  onChange,
  errors,
}: {
  form: RhythmFormData;
  onChange: <K extends keyof RhythmFormData>(k: K, v: RhythmFormData[K]) => void;
  errors: Record<string, string>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Title"
        value={form.name}
        onChange={(e) => onChange('name', e.target.value)}
        error={errors.name}
        required
        placeholder="e.g. Morning Run"
        autoFocus
      />
      <Textarea
        label="Short Note"
        value={form.note}
        onChange={(e) => onChange('note', e.target.value)}
        rows={2}
        placeholder="Any notes about this rhythm..."
      />
      <Select
        label="Category"
        value={form.category}
        onChange={(e) => onChange('category', (e.target as HTMLSelectElement).value)}
        options={RHYTHM_CATEGORIES.map((c) => ({ value: c, label: c }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Time (optional)"
          type="time"
          value={form.time}
          onChange={(e) => {
            onChange('time', e.target.value);
            if (form.reminderEnabled) onChange('time', e.target.value);
          }}
        />
        <Select
          label="Frequency"
          value={form.frequency}
          onChange={(e) => onChange('frequency', (e.target as HTMLSelectElement).value as HabitFrequency)}
          options={[
            { value: 'daily', label: 'Daily' },
            { value: 'weekly', label: 'Weekly' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'yearly', label: 'Yearly' },
          ]}
        />
      </div>
      {/* Reminder toggle */}
      <button
        type="button"
        onClick={() => onChange('reminderEnabled', !form.reminderEnabled)}
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-card border transition-colors text-left',
          form.reminderEnabled
            ? 'bg-[#1ABC9C]/10 border-[#1ABC9C] text-[#1ABC9C]'
            : 'bg-[#F5F5F5] border-[#E5E5EA] text-[#6C6C70]'
        )}
      >
        <div className="flex-1">
          <p className="text-sm font-semibold">Reminder</p>
          <p className="text-xs opacity-70">
            {form.reminderEnabled
              ? form.time ? `Reminder at ${formatTime12(form.time)}` : 'Reminder ON'
              : 'Tap to enable reminder'}
          </p>
        </div>
        <div
          className={cn(
            'w-10 h-6 rounded-full transition-colors flex items-center px-1',
            form.reminderEnabled ? 'bg-[#1ABC9C]' : 'bg-[#E5E5EA]'
          )}
        >
          <div
            className={cn(
              'w-4 h-4 rounded-full bg-white transition-transform',
              form.reminderEnabled ? 'translate-x-4' : 'translate-x-0'
            )}
          />
        </div>
      </button>
    </div>
  );
}

/** Create / Edit Rhythm Modal */
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
  const [form, setForm] = useState<RhythmFormData>(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setErrors({});
      setForm(habit
        ? {
            name: habit.name,
            note: habit.note ?? '',
            category: habit.category || 'Fitness',
            time: habit.time ?? '',
            frequency: habit.frequency,
            reminderEnabled: habit.reminder?.enabled ?? false,
          }
        : { ...EMPTY_FORM }
      );
    }
  }, [open, habit]);

  const handleChange = useCallback(<K extends keyof RhythmFormData>(k: K, v: RhythmFormData[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { setErrors({ name: 'Name is required' }); return; }
    setSaving(true);
    try {
      const colorIndex = RHYTHM_CATEGORIES.indexOf(form.category as typeof RHYTHM_CATEGORIES[number]);
      const color = RHYTHM_COLORS[colorIndex >= 0 ? colorIndex % RHYTHM_COLORS.length : 0];
      const data = {
        userId,
        name: sanitize(form.name, 100),
        note: sanitize(form.note),
        icon: habit?.icon ?? '💪',
        color,
        category: form.category,
        project: habit?.project ?? 'Custom' as const,
        frequency: form.frequency,
        time: form.time || undefined,
        reminder: { enabled: form.reminderEnabled, time: form.time || '08:00' },
        trigger: habit?.trigger ?? '',
        targetCount: habit?.targetCount ?? 1,
        completions: habit?.completions ?? {},
        statusLog: habit?.statusLog ?? {},
        streak: habit?.streak ?? 0,
        bestStreak: habit?.bestStreak ?? 0,
        isActive: true,
        order: habit?.order ?? Date.now(),
      };
      if (habit) {
        await updateDocById(COLLECTIONS.HABITS, habit.id, data);
        toast.success('Rhythm updated.');
      } else {
        await createDoc(COLLECTIONS.HABITS, data);
        toast.success('Rhythm created.');
      }
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
          <Button fullWidth loading={saving} onClick={handleSave}>
            {habit ? 'Save Changes' : 'Save Rhythm'}
          </Button>
        </div>
      }
    >
      <RhythmFormFields form={form} onChange={handleChange} errors={errors} />
    </Modal>
  );
}

// ─── RHYTHM POPUP (view + inline edit) ───────────────────────────────────────

function RhythmPopup({
  habit,
  onClose,
  onDelete,
  onDuplicate,
  userId,
}: {
  habit: Habit;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  userId: string;
}) {
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<RhythmFormData>({
    name: habit.name,
    note: habit.note ?? '',
    category: habit.category || 'Fitness',
    time: habit.time ?? '',
    frequency: habit.frequency,
    reminderEnabled: habit.reminder?.enabled ?? false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleChange = useCallback(<K extends keyof RhythmFormData>(k: K, v: RhythmFormData[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { setErrors({ name: 'Name is required' }); return; }
    setSaving(true);
    try {
      const colorIndex = RHYTHM_CATEGORIES.indexOf(form.category as typeof RHYTHM_CATEGORIES[number]);
      const color = RHYTHM_COLORS[colorIndex >= 0 ? colorIndex % RHYTHM_COLORS.length : 0];
      await updateDocById(COLLECTIONS.HABITS, habit.id, {
        name: sanitize(form.name, 100),
        note: sanitize(form.note),
        color,
        category: form.category,
        frequency: form.frequency,
        time: form.time || undefined,
        reminder: { enabled: form.reminderEnabled, time: form.time || '08:00' },
      });
      toast.success('Rhythm updated.');
      onClose();
    } catch {
      toast.error('Failed to update rhythm.');
    } finally {
      setSaving(false);
    }
  };

  const catColor = CATEGORY_COLORS[habit.category] ?? '#6C6C70';
  const streak = habit.streak;
  const today = todayISO();

  return (
    <Modal
      open
      onClose={onClose}
      title={editMode ? 'Edit Rhythm' : habit.name}
      footer={
        editMode ? (
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => { setEditMode(false); setErrors({}); }}>
              Cancel
            </Button>
            <Button fullWidth loading={saving} onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setEditMode(true)}>
              <Pencil size={14} /> Edit
            </Button>
            <Button size="sm" variant="secondary" onClick={onDuplicate}>
              <Copy size={14} /> Duplicate
            </Button>
            <Button size="sm" variant="danger" onClick={onDelete}>
              <Trash2 size={14} /> Delete
            </Button>
          </div>
        )
      }
    >
      {editMode ? (
        <RhythmFormFields form={form} onChange={handleChange} errors={errors} />
      ) : (
        <div className="flex flex-col gap-4">
          {/* Note */}
          {habit.note && (
            <p className="text-sm text-[#6C6C70] leading-relaxed">{habit.note}</p>
          )}

          {/* 2x3 info grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Time */}
            <div className="bg-[#F5F5F5] rounded-card p-3 border border-[#E5E5EA]">
              <p className="text-xs text-[#AEAEB2] mb-1 flex items-center gap-1">
                <Clock size={10} /> Time
              </p>
              <p className="text-sm font-semibold text-[#1C1C1E]">
                {habit.time ? formatTime12(habit.time) : '—'}
              </p>
            </div>

            {/* Category */}
            <div className="bg-[#F5F5F5] rounded-card p-3 border border-[#E5E5EA]">
              <p className="text-xs text-[#AEAEB2] mb-1">Category</p>
              <Badge label={habit.category} color={catColor} />
            </div>

            {/* Frequency */}
            <div className="bg-[#F5F5F5] rounded-card p-3 border border-[#E5E5EA]">
              <p className="text-xs text-[#AEAEB2] mb-1">Frequency</p>
              <p className="text-sm font-semibold text-[#1C1C1E] capitalize">{habit.frequency}</p>
            </div>

            {/* Reminder */}
            <div className="bg-[#F5F5F5] rounded-card p-3 border border-[#E5E5EA]">
              <p className="text-xs text-[#AEAEB2] mb-1">Reminder</p>
              <p className="text-sm font-semibold text-[#1C1C1E]">
                {habit.reminder?.enabled
                  ? habit.time ? formatTime12(habit.time) : 'ON'
                  : 'OFF'}
              </p>
            </div>

            {/* Current Streak */}
            <div className="bg-[#F5F5F5] rounded-card p-3 border border-[#E5E5EA]">
              <p className="text-xs text-[#AEAEB2] mb-1 flex items-center gap-1">
                <Flame size={10} /> Streak
              </p>
              <p className="text-sm font-semibold text-[#1C1C1E]">
                {streak}d {streak > 3 ? '🔥' : ''}
              </p>
            </div>

            {/* Best Streak */}
            <div className="bg-[#F5F5F5] rounded-card p-3 border border-[#E5E5EA]">
              <p className="text-xs text-[#AEAEB2] mb-1 flex items-center gap-1">
                <Trophy size={10} /> Best
              </p>
              <p className="text-sm font-semibold text-[#1C1C1E]">
                {habit.bestStreak}d 🏆
              </p>
            </div>
          </div>

          {/* 7-day activity strip */}
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-[#AEAEB2]">Last 7 days</p>
            <div className="flex gap-1.5">
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date(today + 'T00:00:00');
                d.setDate(d.getDate() - (6 - i));
                const dateStr = d.toISOString().split('T')[0];
                const s = habit.statusLog[dateStr] as HabitStatus | undefined;
                return (
                  <div key={dateStr} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-[#AEAEB2]">{d.getDate()}</span>
                    <div
                      className={cn(
                        'w-full h-6 rounded-sm flex items-center justify-center text-xs',
                        s === 'done' ? 'bg-[#1ABC9C]' : s === 'failed' ? 'bg-[#FF4F6D]' : 'bg-[#E5E5EA]'
                      )}
                    >
                      {s === 'done' ? '✓' : s === 'failed' ? '✕' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── RHYTHM CARD ──────────────────────────────────────────────────────────────

function RhythmCard({
  habit,
  today,
  onOpenPopup,
}: {
  habit: Habit;
  today: string;
  onOpenPopup: (h: Habit) => void;
}) {
  const status = (habit.statusLog[today] ?? 'pending') as HabitStatus;
  const catColor = CATEGORY_COLORS[habit.category] ?? '#6C6C70';
  const isDoneOrFailed = status === 'done' || status === 'failed';

  const markDone = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const completions = { ...habit.completions, [today]: 1 };
    const statusLog = { ...habit.statusLog, [today]: 'done' as HabitStatus };
    const newStreak = calculateStreak({ ...habit.statusLog, [today]: 'done' });
    const bestStreak = Math.max(habit.bestStreak, newStreak);
    await updateDocById(COLLECTIONS.HABITS, habit.id, {
      completions, statusLog, streak: newStreak, bestStreak,
    });
    toast.success(`${habit.name} done! ✓`);
  };

  const markFailed = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const completions = { ...habit.completions };
    delete completions[today];
    const statusLog = { ...habit.statusLog, [today]: 'failed' as HabitStatus };
    const newStreak = calculateStreak({ ...habit.statusLog, [today]: 'failed' });
    await updateDocById(COLLECTIONS.HABITS, habit.id, {
      completions, statusLog, streak: newStreak,
    });
  };

  const resetStatus = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const completions = { ...habit.completions };
    delete completions[today];
    const statusLog = { ...habit.statusLog };
    delete statusLog[today];
    const newStreak = calculateStreak(statusLog);
    await updateDocById(COLLECTIONS.HABITS, habit.id, {
      completions, statusLog, streak: newStreak,
    });
  };

  return (
    <div
      className={cn(
        'bg-[#FFFFFF] rounded-card border border-[#E5E5EA] p-3 flex items-center gap-3 transition-opacity active:bg-[#F5F5F5] cursor-pointer',
        isDoneOrFailed && 'opacity-50'
      )}
      onClick={() => onOpenPopup(habit)}
    >
      {/* Left: name + time + category */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-sm font-semibold text-[#1C1C1E] truncate',
          status === 'done' && 'line-through text-[#AEAEB2]'
        )}>
          {habit.name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {habit.time && (
            <span className="text-xs text-[#6C6C70] flex items-center gap-0.5">
              <Clock size={10} /> {formatTime12(habit.time)}
            </span>
          )}
          <Badge label={habit.category} color={catColor} />
        </div>
      </div>

      {/* Right: action buttons */}
      <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
        {status === 'pending' ? (
          <>
            {/* Done button — round green 40px */}
            <button
              type="button"
              onClick={markDone}
              aria-label="Mark done"
              className="w-10 h-10 rounded-full bg-[#1ABC9C] flex items-center justify-center text-white active:scale-90 transition-transform"
            >
              <CheckCircle size={20} />
            </button>
            {/* Failed button — round red 40px */}
            <button
              type="button"
              onClick={markFailed}
              aria-label="Mark failed"
              className="w-10 h-10 rounded-full bg-[#FF4F6D] flex items-center justify-center text-white active:scale-90 transition-transform"
            >
              <XCircle size={20} />
            </button>
          </>
        ) : (
          /* Clickable status badge to reset */
          <button
            type="button"
            onClick={resetStatus}
            aria-label="Reset status"
            className={cn(
              'h-10 px-3 rounded-chip text-xs font-semibold border transition-colors',
              status === 'done'
                ? 'bg-[#1ABC9C]/15 text-[#1ABC9C] border-[#1ABC9C]/30 hover:bg-[#1ABC9C]/25'
                : 'bg-[#FF4F6D]/15 text-[#FF4F6D] border-[#FF4F6D]/30 hover:bg-[#FF4F6D]/25'
            )}
          >
            {status === 'done' ? '✓ Done' : '✕ Failed'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── POMODORO PANEL ───────────────────────────────────────────────────────────

function PomodoroPanel({ userId, onClose }: { userId: string; onClose: () => void }) {
  const {
    settings, sessionType, display, isRunning, sessionsCompleted,
    start, pause, reset, skip, updateSettings,
  } = usePomodoroTimer(userId);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localWork, setLocalWork] = useState(String(settings.workDuration));
  const [localShort, setLocalShort] = useState(String(settings.shortBreakDuration));
  const [localLong, setLocalLong] = useState(String(settings.longBreakDuration));

  const typeLabels = { work: 'Focus', 'short-break': 'Short Break', 'long-break': 'Long Break' };
  const typeColors = { work: '#FF6B35', 'short-break': '#1ABC9C', 'long-break': '#1E4AFF' };
  const color = typeColors[sessionType];

  // Total seconds for current session
  const totalSeconds =
    sessionType === 'work' ? settings.workDuration * 60
    : sessionType === 'short-break' ? settings.shortBreakDuration * 60
    : settings.longBreakDuration * 60;

  // Time left in seconds (parsed from display MM:SS)
  const [mins, secs] = display.split(':').map(Number);
  const timeLeftSecs = mins * 60 + secs;
  const progress = totalSeconds > 0 ? ((totalSeconds - timeLeftSecs) / totalSeconds) * 100 : 0;

  const applySettings = () => {
    updateSettings({
      ...settings,
      workDuration: Math.max(1, Math.min(120, parseInt(localWork) || 25)),
      shortBreakDuration: Math.max(1, Math.min(60, parseInt(localShort) || 5)),
      longBreakDuration: Math.max(1, Math.min(60, parseInt(localLong) || 15)),
    });
    setSettingsOpen(false);
  };

  return (
    <>
      <div className="fixed bottom-[72px] right-4 z-50 sm:bottom-6 sm:right-6 bg-[#FFFFFF] border border-[#E5E5EA] rounded-card p-4 w-60 shadow-card">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold" style={{ color }}>
            {typeLabels[sessionType]}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label="Timer settings"
              className="w-8 h-8 flex items-center justify-center text-[#6C6C70] hover:text-[#1C1C1E] rounded-full hover:bg-[#F5F5F5]"
            >
              <Settings size={15} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close timer"
              className="w-8 h-8 flex items-center justify-center text-[#6C6C70] hover:text-[#1C1C1E] rounded-full hover:bg-[#F5F5F5] text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Circular SVG progress */}
        <div className="flex justify-center mb-3">
          <div className="relative w-28 h-28">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="44" fill="none" stroke="#E5E5EA" strokeWidth="8" />
              <circle
                cx="50" cy="50" r="44" fill="none"
                stroke={color} strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 44}`}
                strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
                style={{ transition: 'stroke-dashoffset 1s linear' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-[#1C1C1E] tabular-nums">{display}</span>
              <span className="text-[10px] text-[#6C6C70]">Session {sessionsCompleted + 1}</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2 justify-center">
          <button
            type="button"
            onClick={reset}
            aria-label="Reset timer"
            className="w-10 h-10 rounded-full bg-[#F5F5F5] border border-[#E5E5EA] flex items-center justify-center text-[#6C6C70] hover:text-[#1C1C1E]"
          >
            <RotateCcw size={14} />
          </button>
          <button
            type="button"
            onClick={isRunning ? pause : start}
            aria-label={isRunning ? 'Pause' : 'Play'}
            className="w-12 h-12 rounded-full flex items-center justify-center text-white"
            style={{ backgroundColor: color }}
          >
            {isRunning ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            type="button"
            onClick={skip}
            aria-label="Skip session"
            className="w-10 h-10 rounded-full bg-[#F5F5F5] border border-[#E5E5EA] flex items-center justify-center text-[#6C6C70] hover:text-[#1C1C1E]"
          >
            <SkipForward size={14} />
          </button>
        </div>
      </div>

      {/* Settings modal */}
      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Timer Settings"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button fullWidth onClick={applySettings}>Apply</Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <Input
            label="Work duration (minutes)"
            type="number"
            value={localWork}
            onChange={(e) => setLocalWork(e.target.value)}
          />
          <Input
            label="Short break (minutes)"
            type="number"
            value={localShort}
            onChange={(e) => setLocalShort(e.target.value)}
          />
          <Input
            label="Long break (minutes)"
            type="number"
            value={localLong}
            onChange={(e) => setLocalLong(e.target.value)}
          />
        </div>
      </Modal>
    </>
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

  const today = todayISO();
  const [modalOpen, setModalOpen] = useState(false);
  const [editHabit, setEditHabit] = useState<Habit | null>(null);
  const [popupHabit, setPopupHabit] = useState<Habit | null>(null);
  const [deleteHabit, setDeleteHabit] = useState<Habit | null>(null);
  const [pomodoroOpen, setPomodoroOpen] = useState(false);

  // ── KPI calculations ─────────────────────────────────────────────────────
  const activeHabits = habits.filter((h) => h.isActive);
  const doneToday = activeHabits.filter((h) => h.statusLog[today] === 'done').length;
  const pendingToday = activeHabits.filter((h) => !h.statusLog[today]).length;
  const avgStreak = activeHabits.length
    ? Math.round(activeHabits.reduce((s, h) => s + h.streak, 0) / activeHabits.length)
    : 0;
  const bestStreak = activeHabits.length
    ? Math.max(...activeHabits.map((h) => h.bestStreak))
    : 0;
  const completionPct = activeHabits.length
    ? Math.round((doneToday / activeHabits.length) * 100)
    : 0;

  // ── Sort: pending first → by time → alphabetically ────────────────────────
  const sorted = [...activeHabits].sort((a, b) => {
    const aStatus = a.statusLog[today] ?? 'pending';
    const bStatus = b.statusLog[today] ?? 'pending';
    const aPending = aStatus === 'pending' ? 0 : 1;
    const bPending = bStatus === 'pending' ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    // Sort by time (no time = sort last)
    const aTime = a.time ?? '99:99';
    const bTime = b.time ?? '99:99';
    if (aTime !== bTime) return aTime.localeCompare(bTime);
    return a.name.localeCompare(b.name);
  });

  // ── Delete handler ────────────────────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!deleteHabit) return;
    await deleteDocById(COLLECTIONS.HABITS, deleteHabit.id);
    toast.success('Rhythm deleted.');
    setDeleteHabit(null);
    setPopupHabit(null);
  }, [deleteHabit]);

  // ── Duplicate handler ─────────────────────────────────────────────────────
  const handleDuplicate = useCallback(async (habit: Habit) => {
    const { id: _id, ...rest } = habit;
    void _id;
    await createDoc(COLLECTIONS.HABITS, {
      ...rest,
      name: `${habit.name} (Copy)`,
      streak: 0,
      bestStreak: 0,
      completions: {},
      statusLog: {},
      order: Date.now(),
      createdAt: new Date().toISOString(),
    });
    toast.success('Rhythm duplicated.');
    setPopupHabit(null);
  }, []);

  return (
    <div className="flex flex-col min-h-dvh">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#E5E5EA]">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-[#1C1C1E]">My Rhythms</h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPomodoroOpen(!pomodoroOpen)}
              aria-label="Pomodoro timer"
              className="w-10 h-10 bg-[#FFFFFF] border border-[#E5E5EA] rounded-full flex items-center justify-center text-[#FF6B35]"
            >
              <Timer size={16} />
            </button>
            <Button size="sm" onClick={() => { setEditHabit(null); setModalOpen(true); }}>
              <Plus size={15} /> Add Rhythm
            </Button>
          </div>
        </div>

        {/* KPI cards — only when rhythms exist */}
        {activeHabits.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {/* Today's Completion */}
            <div className="bg-[#FFFFFF] rounded-card p-3 border border-[#E5E5EA] col-span-2">
              <div className="flex justify-between items-center mb-1.5">
                <p className="text-xs text-[#6C6C70]">Today&apos;s Completion</p>
                <span className="text-xs font-semibold text-[#1ABC9C]">
                  {doneToday}/{activeHabits.length}
                </span>
              </div>
              <ProgressBar value={completionPct} color="#1ABC9C" height={6} />
              <p className="text-xs text-[#1ABC9C] mt-1">{completionPct}%</p>
            </div>
            {/* Avg Streak */}
            <div className="bg-[#FFFFFF] rounded-card p-3 border border-[#E5E5EA]">
              <p className="text-xs text-[#6C6C70] mb-1">Avg Streak</p>
              <p className="text-lg font-bold text-[#FF6B35]">{avgStreak}d</p>
            </div>
            {/* Best Streak */}
            <div className="bg-[#FFFFFF] rounded-card p-3 border border-[#E5E5EA]">
              <p className="text-xs text-[#6C6C70] mb-1">Best Streak</p>
              <p className="text-lg font-bold text-[#FFD700]">{bestStreak}d</p>
            </div>
            {/* Pending */}
            <div className="bg-[#FFFFFF] rounded-card p-3 border border-[#E5E5EA] col-span-2">
              <p className="text-xs text-[#6C6C70] mb-1">Pending Today</p>
              <p className="text-lg font-bold text-[#FF9933]">{pendingToday}</p>
            </div>
          </div>
        )}
      </div>

      {/* Winner's Mindset */}
      <WinnersMindset />

      {/* Rhythm list */}
      <div className="flex-1 px-4 py-4 pb-24 flex flex-col gap-3">
        {loading ? (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No rhythms yet"
            subtitle="Build your first daily rhythm to track habits consistently."
            actionLabel="Add Rhythm"
            onAction={() => { setEditHabit(null); setModalOpen(true); }}
          />
        ) : (
          sorted.map((habit) => (
            <RhythmCard
              key={habit.id}
              habit={habit}
              today={today}
              onOpenPopup={setPopupHabit}
            />
          ))
        )}
      </div>

      {/* FAB (mobile) */}
      <button
        type="button"
        onClick={() => { setEditHabit(null); setModalOpen(true); }}
        className="fixed bottom-[80px] right-4 w-14 h-14 bg-[#1ABC9C] rounded-full flex items-center justify-center shadow-fab active:scale-95 transition-transform sm:hidden z-30"
        aria-label="Add rhythm"
      >
        <Plus size={24} className="text-white" />
      </button>

      {/* Pomodoro panel */}
      {pomodoroOpen && user && (
        <PomodoroPanel userId={user.uid} onClose={() => setPomodoroOpen(false)} />
      )}

      {/* Create / Edit modal */}
      <RhythmModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        habit={editHabit}
        userId={user?.uid ?? ''}
      />

      {/* Rhythm detail popup */}
      {popupHabit && (
        <RhythmPopup
          habit={popupHabit}
          onClose={() => setPopupHabit(null)}
          onDelete={() => setDeleteHabit(popupHabit)}
          onDuplicate={() => handleDuplicate(popupHabit)}
          userId={user?.uid ?? ''}
        />
      )}

      {/* Delete confirm */}
      <ConfirmModal
        open={!!deleteHabit}
        onClose={() => setDeleteHabit(null)}
        onConfirm={handleDelete}
        title="Delete Rhythm"
        message={`Delete "${deleteHabit?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
