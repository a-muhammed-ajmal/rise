'use client';

import { useState, useEffect, useMemo, type ChangeEvent } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection, addDocument, updateDocument, deleteDocument } from '@/lib/firestore';
import { Habit, RHYTHM_CATEGORIES, type HabitFrequency, type HabitCategory, type HabitStatus } from '@/lib/types';
import { cn, formatTime } from '@/lib/utils';
import { Plus, Flame, Check, X, ChevronDown, Clock, Tag, Trash2, Copy, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import dynamic from 'next/dynamic';
const Modal = dynamic(() => import('@/components/ui/Modal'), { ssr: false });
import Button from '@/components/ui/Button';
import { Input, Select, TextArea } from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';

const PRESET_COLORS = ['#FF9933', '#DC4C3E', '#4073FF', '#2D7C3E', '#7B4B9E', '#E8849B', '#4A9B8E', '#F49C18', '#10B981', '#EF4444'];

const CATEGORY_COLORS: Record<string, string> = {
  Affirmation: '#F59E0B',
  Meditation: '#8B5CF6',
  Dedication: '#EF4444',
  Discipline: '#DC2626',
  Fitness: '#10B981',
  Learning: '#3B82F6',
  Spiritual: '#A78BFA',
  'Personal Growth': '#EC4899',
  Health: '#14B8A6',
  Work: '#6366F1',
  Productivity: '#F97316',
  'Morning Routine': '#FF9933',
  'Evening Routine': '#7C3AED',
  Finance: '#059669',
  Social: '#F472B6',
  Creativity: '#FBBF24',
  Mindfulness: '#818CF8',
  Nutrition: '#34D399',
  'Self-Care': '#FB923C',
  Other: '#6B7280',
};

export default function WellnessPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: habits, loading } = useCollection<Habit>('habits', uid, 'order');

  const [modalOpen, setModalOpen] = useState(false);
  const [viewHabit, setViewHabit] = useState<Habit | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');

  // Form state
  const [formData, setFormData] = useState({
    name: '', note: '', time: '', category: 'Health' as string,
    frequency: 'daily' as HabitFrequency,
    reminderEnabled: false,
  });

  const resetForm = () => {
    setFormData({ name: '', note: '', time: '', category: 'Health', frequency: 'daily', reminderEnabled: false });
    setIsEditing(false);
  };

  useEffect(() => {
    if (!modalOpen && !viewHabit) resetForm();
  }, [modalOpen, viewHabit]);

  const openAddModal = () => {
    resetForm();
    setViewHabit(null);
    setIsEditing(true);
    setModalOpen(true);
  };

  const openViewModal = (habit: Habit) => {
    setViewHabit(habit);
    setIsEditing(false);
    setModalOpen(true);
    // Populate form for potential edit
    setFormData({
      name: habit.name,
      note: habit.note || habit.notes || '',
      time: habit.time || '',
      category: habit.category || 'Other',
      frequency: habit.frequency,
      reminderEnabled: habit.reminder?.enabled ?? false,
    });
  };

  const startEditing = () => setIsEditing(true);

  const handleSubmit = async () => {
    if (!user || !formData.name.trim()) return;
    const reminderObj = { enabled: formData.reminderEnabled, time: formData.time || '' };

    if (viewHabit) {
      // Update existing
      await updateDocument('habits', viewHabit.id, {
        name: formData.name.trim(),
        note: formData.note || undefined,
        time: formData.time || undefined,
        category: formData.category,
        project: formData.category as any,
        frequency: formData.frequency,
        reminder: reminderObj,
      });
    } else {
      // Create new
      await addDocument('habits', {
        name: formData.name.trim(),
        note: formData.note || undefined,
        icon: '💪',
        color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)],
        category: formData.category,
        project: formData.category as any,
        time: formData.time || undefined,
        frequency: formData.frequency,
        targetCount: 1,
        completions: {},
        statusLog: {},
        streak: 0,
        bestStreak: 0,
        isActive: true,
        order: Date.now(),
        reminder: reminderObj,
      } as Partial<Habit>, user.uid);
    }
    setModalOpen(false);
    setViewHabit(null);
    resetForm();
  };

  const handleDuplicate = async () => {
    if (!user || !viewHabit) return;
    await addDocument('habits', {
      name: `${viewHabit.name} (Copy)`,
      note: viewHabit.note,
      icon: viewHabit.icon,
      color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)],
      category: viewHabit.category,
      project: viewHabit.project,
      time: viewHabit.time,
      frequency: viewHabit.frequency,
      targetCount: 1,
      completions: {},
      statusLog: {},
      streak: 0,
      bestStreak: 0,
      isActive: true,
      order: Date.now(),
      reminder: viewHabit.reminder || { enabled: false, time: '' },
    } as Partial<Habit>, user.uid);
    setModalOpen(false);
    setViewHabit(null);
  };

  const handleDelete = async () => {
    if (!viewHabit) return;
    await deleteDocument('habits', viewHabit.id);
    setShowDeleteConfirm(false);
    setModalOpen(false);
    setViewHabit(null);
  };

  // Mark rhythm done or failed for today
  const markStatus = async (habit: Habit, status: HabitStatus) => {
    try {
      await runTransaction(db, async (transaction) => {
        const habitRef = doc(db, 'habits', habit.id);
        const snap = await transaction.get(habitRef);
        if (!snap.exists()) return;
        const data = snap.data();

        const completions: Record<string, number> = { ...(data.completions || {}) };
        const statusLog: Record<string, string> = { ...(data.statusLog || {}) };

        if (status === 'done') {
          completions[today] = 1;
        } else {
          delete completions[today];
        }
        statusLog[today] = status;

        // Recalculate streak
        let streak = 0;
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        if (!completions[format(d, 'yyyy-MM-dd')]) {
          d.setDate(d.getDate() - 1);
        }
        while (true) {
          const key = format(d, 'yyyy-MM-dd');
          if (completions[key]) { streak++; d.setDate(d.getDate() - 1); }
          else break;
        }
        const bestStreak = Math.max(streak, data.bestStreak || 0);
        transaction.update(habitRef, { completions, statusLog, streak, bestStreak });
      });
    } catch (err) {
      console.error('[Wellness] Failed to mark status:', err);
    }
  };

  // Get today's status
  const getTodayStatus = (habit: Habit): HabitStatus => {
    return (habit.statusLog?.[today] as HabitStatus) || 'pending';
  };

  // Sorted habits, pending first
  const sortedHabits = useMemo(() => {
    return [...(habits || [])].sort((a, b) => {
      const statusA = getTodayStatus(a);
      const statusB = getTodayStatus(b);
      // Pending first, then done/failed
      if (statusA === 'pending' && statusB !== 'pending') return -1;
      if (statusA !== 'pending' && statusB === 'pending') return 1;
      // Then by time
      if (!a.time && !b.time) return a.name.localeCompare(b.name);
      if (!a.time) return 1;
      if (!b.time) return -1;
      return a.time.localeCompare(b.time);
    });
  }, [habits, today]);

  const pendingCount = sortedHabits.filter(h => getTodayStatus(h) === 'pending').length;
  const doneCount = sortedHabits.filter(h => getTodayStatus(h) === 'done').length;
  const totalCount = sortedHabits.length;

  const seedDefaultHabits = async () => {
    if (!user) return;
    const defaults = [
      { name: 'Start day at 6 am', time: '06:00', category: 'Discipline' },
      { name: 'Drink 1 full glass of water', time: '06:05', category: 'Health' },
      { name: 'Read my positive affirmation', time: '06:10', category: 'Affirmation' },
      { name: 'Review Daily Goals', time: '06:15', category: 'Productivity' },
      { name: 'Morning Exercise', time: '06:30', category: 'Fitness' },
      { name: 'Deep breath exercise', time: '07:00', category: 'Mindfulness' },
      { name: 'Meditate for 3 minutes', time: '07:10', category: 'Meditation' },
      { name: 'Listen to the Educational Video', time: '07:20', category: 'Learning' },
      { name: 'Follow-ups with leads', time: '09:00', category: 'Work' },
      { name: 'New LinkedIn Connections', time: '09:30', category: 'Social' },
      { name: 'Meet 50 new customers', time: '10:00', category: 'Dedication' },
      { name: 'Set out things for tomorrow', time: '22:00', category: 'Evening Routine' },
      { name: 'Evening Review', time: '22:15', category: 'Personal Growth' },
      { name: 'Plan Tomorrow', time: '22:30', category: 'Productivity' },
      { name: 'Define the MIT for tomorrow', time: '22:45', category: 'Discipline' },
    ];
    for (const h of defaults) {
      await addDocument('habits', {
        name: h.name, icon: '💪', color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)],
        category: h.category, project: 'Custom' as any, time: h.time, frequency: 'daily',
        targetCount: 1, completions: {}, statusLog: {}, streak: 0, bestStreak: 0,
        isActive: true, order: Date.now() + Math.random(),
        reminder: { enabled: false, time: '' },
      } as Partial<Habit>, user.uid);
    }
    window.location.reload();
  };

  return (
    <div className="px-4 py-6 lg:px-8 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">My Rhythms</h1>
          {totalCount > 0 && (
            <p className="text-xs text-text-3 mt-0.5">
              {doneCount}/{totalCount} completed · {pendingCount} pending
            </p>
          )}
        </div>
        <button onClick={openAddModal}
          className="flex items-center gap-1.5 px-3 py-2 bg-rise text-[#0A0A0F] rounded-lg text-xs font-semibold">
          <Plus size={14} /> Add Rhythm
        </button>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="bg-surface-2 rounded-xl border border-border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-text">Today&apos;s Progress</span>
            <span className="text-sm font-semibold text-text">{totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0}%</span>
          </div>
          <div className="w-full h-2 bg-border rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-[#1ABC9C] transition-all" style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-surface-2 animate-pulse" />)}</div>
      ) : sortedHabits.length === 0 ? (
        <EmptyState
          icon={Flame}
          title="No rhythms yet"
          description="Build consistent rhythms to improve your life"
          action={
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Button onClick={openAddModal} className="w-full"><Plus size={16} /> Create Custom Rhythm</Button>
              <Button onClick={seedDefaultHabits} variant="secondary" className="w-full">
                <Flame size={16} /> Add Default Routine
              </Button>
            </div>
          }
        />
      ) : (
        <div className="space-y-2.5">
          {sortedHabits.map(habit => {
            const status = getTodayStatus(habit);
            const catColor = CATEGORY_COLORS[habit.category] || CATEGORY_COLORS.Other;
            return (
              <div
                key={habit.id}
                className={cn(
                  'bg-surface-2 rounded-xl border border-border p-4 transition-all',
                  status !== 'pending' && 'opacity-50',
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Left: Content */}
                  <button onClick={() => openViewModal(habit)} className="flex-1 text-left min-w-0">
                    <p className={cn(
                      'text-sm font-semibold text-text truncate',
                      status === 'done' && 'line-through text-text-3',
                    )}>{habit.name}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      {habit.time && (
                        <span className="flex items-center gap-1 text-xs text-text-3">
                          <Clock size={11} />
                          {formatTime(habit.time)}
                        </span>
                      )}
                      <span
                        className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${catColor}18`, color: catColor }}
                      >
                        {habit.category || 'Other'}
                      </span>
                    </div>
                  </button>

                  {/* Right: Action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {status === 'pending' ? (
                      <>
                        <button
                          onClick={() => markStatus(habit, 'done')}
                          className="w-10 h-10 rounded-full bg-green-500/15 flex items-center justify-center hover:bg-green-500/25 transition-colors"
                          title="Done"
                        >
                          <Check size={18} className="text-green-500" />
                        </button>
                        <button
                          onClick={() => markStatus(habit, 'failed')}
                          className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center hover:bg-red-500/25 transition-colors"
                          title="Failed"
                        >
                          <X size={18} className="text-red-500" />
                        </button>
                      </>
                    ) : (
                      <span className={cn(
                        'text-xs font-semibold px-3 py-1.5 rounded-full',
                        status === 'done' ? 'bg-green-500/15 text-green-500' : 'bg-red-500/15 text-red-500',
                      )}>
                        {status === 'done' ? 'Done' : 'Failed'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setViewHabit(null); setShowDeleteConfirm(false); resetForm(); }}
        title={!viewHabit ? 'New Rhythm' : isEditing ? 'Edit Rhythm' : viewHabit.name}
      >
        {showDeleteConfirm ? (
          <div className="space-y-4">
            <p className="text-sm text-text-2">Are you sure you want to delete this rhythm? This cannot be undone.</p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)} className="flex-1">Cancel</Button>
              <button onClick={handleDelete} className="flex-1 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 transition-colors">
                Delete
              </button>
            </div>
          </div>
        ) : !viewHabit || isEditing ? (
          /* ──── Edit / Create Form ──── */
          <div className="space-y-4">
            <Input label="Title" value={formData.name} maxLength={100}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Morning Exercise" />
            <TextArea label="Short Note (optional)" value={formData.note}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, note: e.target.value })}
              placeholder="A short note about this rhythm..." rows={2} />
            <Select label="Category" value={formData.category}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, category: e.target.value })}
              options={RHYTHM_CATEGORIES.map(c => ({ value: c, label: c }))} />
            <Input label="Time" type="time" value={formData.time}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, time: e.target.value })} />
            <Select label="Frequency" value={formData.frequency}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, frequency: e.target.value as HabitFrequency })}
              options={[
                { value: 'daily', label: 'Daily' },
                { value: 'weekly', label: 'Weekly' },
                { value: 'monthly', label: 'Monthly' },
                { value: 'yearly', label: 'Yearly' },
              ]} />
            {/* Reminder Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-text-2">Reminder</label>
                {formData.reminderEnabled && formData.time && (
                  <p className="text-[11px] text-text-3 mt-0.5">Reminds at {formatTime(formData.time)}</p>
                )}
              </div>
              <button
                onClick={() => setFormData({ ...formData, reminderEnabled: !formData.reminderEnabled })}
                className={cn('w-11 h-6 rounded-full transition-colors relative',
                  formData.reminderEnabled ? 'bg-rise' : 'bg-surface-3')}
              >
                <div className={cn('w-4.5 h-4.5 bg-white rounded-full absolute top-[3px] transition-transform',
                  formData.reminderEnabled ? 'translate-x-[22px]' : 'translate-x-[3px]')} />
              </button>
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="secondary" onClick={() => { if (viewHabit) setIsEditing(false); else { setModalOpen(false); } }} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={!formData.name.trim()} className="flex-1">
                {viewHabit ? 'Save Changes' : 'Save Rhythm'}
              </Button>
            </div>
          </div>
        ) : (
          /* ──── View Mode ──── */
          <div className="space-y-4">
            {viewHabit.note && (
              <p className="text-sm text-text-2">{viewHabit.note}</p>
            )}
            {viewHabit.notes && !viewHabit.note && (
              <p className="text-sm text-text-2">{viewHabit.notes}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-surface-3 rounded-lg p-3">
                <p className="text-[10px] text-text-3 uppercase tracking-wider mb-1">Time</p>
                <p className="text-sm font-medium text-text">{viewHabit.time ? formatTime(viewHabit.time) : '—'}</p>
              </div>
              <div className="bg-surface-3 rounded-lg p-3">
                <p className="text-[10px] text-text-3 uppercase tracking-wider mb-1">Category</p>
                <p className="text-sm font-medium text-text">{viewHabit.category || 'Other'}</p>
              </div>
              <div className="bg-surface-3 rounded-lg p-3">
                <p className="text-[10px] text-text-3 uppercase tracking-wider mb-1">Frequency</p>
                <p className="text-sm font-medium text-text capitalize">{viewHabit.frequency}</p>
              </div>
              <div className="bg-surface-3 rounded-lg p-3">
                <p className="text-[10px] text-text-3 uppercase tracking-wider mb-1">Reminder</p>
                <p className="text-sm font-medium text-text">
                  {viewHabit.reminder?.enabled ? `ON — ${viewHabit.time ? formatTime(viewHabit.time) : ''}` : 'OFF'}
                </p>
              </div>
              <div className="bg-surface-3 rounded-lg p-3">
                <p className="text-[10px] text-text-3 uppercase tracking-wider mb-1">Streak</p>
                <p className="text-sm font-medium text-text">{viewHabit.streak || 0} days {viewHabit.streak > 3 ? '🔥' : ''}</p>
              </div>
              <div className="bg-surface-3 rounded-lg p-3">
                <p className="text-[10px] text-text-3 uppercase tracking-wider mb-1">Best Streak</p>
                <p className="text-sm font-medium text-text">{viewHabit.bestStreak || 0} days 🏆</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button onClick={startEditing}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-surface-3 text-sm font-medium text-text hover:bg-surface-4 transition-colors">
                <Pencil size={14} /> Edit
              </button>
              <button onClick={handleDuplicate}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-surface-3 text-sm font-medium text-text hover:bg-surface-4 transition-colors">
                <Copy size={14} /> Duplicate
              </button>
              <button onClick={() => setShowDeleteConfirm(true)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-red-500/10 text-sm font-medium text-red-500 hover:bg-red-500/20 transition-colors">
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
