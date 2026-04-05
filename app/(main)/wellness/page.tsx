'use client';

import { useState, useEffect, useMemo, type ChangeEvent } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection, addDocument, updateDocument } from '@/lib/firestore';
import { Habit, HABIT_CATEGORIES, type HabitFrequency, type HabitProject, HABIT_PROJECTS } from '@/lib/types';
import { cn, formatTime } from '@/lib/utils';
import { Plus, Flame, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, isAfter, isSameDay, isBefore } from 'date-fns';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import dynamic from 'next/dynamic';
const Modal = dynamic(() => import('@/components/ui/Modal'), { ssr: false });
import Button from '@/components/ui/Button';
import { Input, Select, TextArea } from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';

const PRESET_COLORS = ['#FF9933', '#DC4C3E', '#4073FF', '#2D7C3E', '#7B4B9E', '#E8849B', '#4A9B8E', '#F49C18', '#10B981', '#EF4444'];

export default function WellnessPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: habits, loading } = useCollection<Habit>('habits', uid, 'order');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  // Week navigation
  const [currentWeekStart, setCurrentWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekLabel = `Week of ${format(currentWeekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}`;

  // Form state
  const [formData, setFormData] = useState({
    name: '', time: '', project: 'Morning Routine' as HabitProject,
    frequency: 'daily' as HabitFrequency, reminder: false,
    reminderOption: 'at-time' as string, notes: '',
  });

  useEffect(() => {
    if (!modalOpen) {
      setEditingHabit(null);
      setFormData({ name: '', time: '', project: 'Morning Routine', frequency: 'daily', reminder: false, reminderOption: 'at-time', notes: '' });
    }
  }, [modalOpen]);

  const openAddModal = () => {
    setEditingHabit(null);
    setFormData({ name: '', time: '', project: 'Morning Routine', frequency: 'daily', reminder: false, reminderOption: 'at-time', notes: '' });
    setModalOpen(true);
  };

  const openEditModal = (habit: Habit) => {
    setEditingHabit(habit);
    setFormData({
      name: habit.name, time: habit.time || '',
      project: (habit.project || habit.category || 'Custom') as HabitProject,
      frequency: habit.frequency, reminder: habit.reminder || false,
      reminderOption: habit.reminderOption || 'at-time', notes: habit.notes || '',
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !formData.name.trim()) return;
    if (editingHabit) {
      await updateDocument('habits', editingHabit.id, {
        name: formData.name.trim(), time: formData.time || undefined,
        project: formData.project, category: formData.project,
        frequency: formData.frequency, reminder: formData.reminder,
        reminderOption: formData.reminder ? formData.reminderOption : undefined,
        notes: formData.notes || undefined,
      });
    } else {
      await addDocument('habits', {
        name: formData.name.trim(), icon: '💪', color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)],
        category: formData.project, project: formData.project,
        time: formData.time || undefined, frequency: formData.frequency,
        targetCount: 1, completions: {}, streak: 0, bestStreak: 0,
        isActive: true, order: Date.now(), reminder: formData.reminder,
        reminderOption: formData.reminder ? formData.reminderOption : undefined,
        notes: formData.notes || undefined,
      } as Partial<Habit>, user.uid);
    }
    setModalOpen(false);
  };

  const seedDefaultHabits = async () => {
    if (!user) return;
    const defaults = [
      { name: 'Start day at 6 am', time: '06:00', project: 'Morning Routine' },
      { name: 'Drink 1 full glass of water', time: '06:05', project: 'Morning Routine' },
      { name: 'Read my positive affirmation', time: '06:10', project: 'Morning Routine' },
      { name: 'Review Daily Goals', time: '06:15', project: 'Morning Routine' },
      { name: 'Morning Exercise', time: '06:30', project: 'Morning Routine' },
      { name: 'Deep breath exercise', time: '07:00', project: 'Morning Routine' },
      { name: 'Meditate for 3 minutes', time: '07:10', project: 'Morning Routine' },
      { name: 'Listen to the Educational Video', time: '07:20', project: 'Morning Routine' },
      { name: 'Follow-ups with leads', time: '09:00', project: 'Business Discipline' },
      { name: 'New LinkedIn Connections', time: '09:30', project: 'Business Discipline' },
      { name: 'Meet 50 new customers', time: '10:00', project: 'Business Discipline' },
      { name: 'Set out things for tomorrow', time: '22:00', project: 'Evening Routine' },
      { name: 'Evening Review', time: '22:15', project: 'Evening Routine' },
      { name: 'Plan Tomorrow', time: '22:30', project: 'Evening Routine' },
      { name: 'Define the MIT for tomorrow', time: '22:45', project: 'Evening Routine' },
    ];
    for (const h of defaults) {
      await addDocument('habits', {
        name: h.name, icon: '💪', color: PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)],
        category: h.project, project: h.project, time: h.time, frequency: 'daily',
        targetCount: 1, completions: {}, streak: 0, bestStreak: 0,
        isActive: true, order: Date.now() + Math.random(),
      } as Partial<Habit>, user.uid);
    }
    window.location.reload();
  };

  // Toggle habit for a specific day
  const toggleHabit = async (habit: Habit, dayStr: string) => {
    const dayDate = new Date(dayStr);
    dayDate.setHours(0, 0, 0, 0);
    // Cannot toggle future dates
    if (isAfter(dayDate, today)) return;

    try {
      await runTransaction(db, async (transaction) => {
        const habitRef = doc(db, 'habits', habit.id);
        const snap = await transaction.get(habitRef);
        if (!snap.exists()) return;
        const data = snap.data();
        const completions: Record<string, number> = { ...(data.completions || {}) };
        const currentCount = completions[dayStr] || 0;
        if (currentCount > 0) delete completions[dayStr];
        else completions[dayStr] = 1;

        // Recalculate streak
        let streak = 0;
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        // Start from today or yesterday
        if (!completions[format(d, 'yyyy-MM-dd')]) {
          d.setDate(d.getDate() - 1);
        }
        while (true) {
          const key = format(d, 'yyyy-MM-dd');
          if (completions[key]) { streak++; d.setDate(d.getDate() - 1); }
          else break;
        }
        const bestStreak = Math.max(streak, data.bestStreak || 0);
        transaction.update(habitRef, { completions, streak, bestStreak });
      });
    } catch (err) {
      console.error('[Wellness] Failed to toggle habit:', err);
    }
  };

  // Calculate streak for display
  const getStreak = (habit: Habit) => habit.streak || 0;

  // Weekly success rate
  const weeklyStats = useMemo(() => {
    if (!habits.length) return { completed: 0, total: 0, rate: 0 };
    const total = habits.length * 7;
    let completed = 0;
    for (const h of habits) {
      for (const day of weekDays) {
        const key = format(day, 'yyyy-MM-dd');
        if ((h.completions?.[key] || 0) > 0) completed++;
      }
    }
    return { completed, total, rate: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }, [habits, weekDays]);

  const sortedHabits = [...(habits || [])].sort((a, b) => {
    if (!a.time && !b.time) return a.name.localeCompare(b.name);
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });

  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  return (
    <div className="px-4 py-6 lg:px-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text">My Habits</h1>
        <button onClick={openAddModal}
          className="flex items-center gap-1.5 px-3 py-2 bg-rise text-[#0A0A0F] rounded-lg text-xs font-semibold">
          <Plus size={14} /> Add Habit
        </button>
      </div>

      {/* Week Selector */}
      <div className="flex items-center justify-center gap-4">
        <button onClick={() => setCurrentWeekStart(w => subWeeks(w, 1))} className="p-2 rounded-lg hover:bg-surface-2 text-text-3">
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold text-text min-w-[200px] text-center">{weekLabel}</span>
        <button onClick={() => setCurrentWeekStart(w => addWeeks(w, 1))} className="p-2 rounded-lg hover:bg-surface-2 text-text-3">
          <ChevronRight size={18} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-surface-2 animate-pulse" />)}</div>
      ) : sortedHabits.length === 0 ? (
        <EmptyState
          icon={Flame}
          title="No habits yet"
          description="Build consistent habits to improve your life"
          action={
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Button onClick={openAddModal} className="w-full"><Plus size={16} /> Create Custom Habit</Button>
              <Button onClick={seedDefaultHabits} variant="secondary" className="w-full">
                <Flame size={16} /> Add Default Routine
              </Button>
            </div>
          }
        />
      ) : (
        <>
          {/* Weekly Success Rate */}
          <div className="bg-surface-2 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-text">Weekly Success Rate</span>
              <span className="text-sm font-semibold text-text">{weeklyStats.rate}%</span>
            </div>
            <div className="w-full h-2 bg-border rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-[#1ABC9C] transition-all" style={{ width: `${weeklyStats.rate}%` }} />
            </div>
            <p className="text-xs text-text-3 mt-1">{weeklyStats.completed} of {weeklyStats.total} completed</p>
          </div>

          {/* ──── DESKTOP: Table View ──── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs text-text-3 font-semibold py-3 pr-4 min-w-[180px]">Habit Name</th>
                  {weekDays.map((day, i) => (
                    <th key={i} className="text-center text-xs text-text-3 font-semibold py-3 w-12">
                      <div>{dayLabels[i]}</div>
                      <div className="text-[10px] font-normal">{format(day, 'd')}</div>
                    </th>
                  ))}
                  <th className="text-center text-xs text-text-3 font-semibold py-3 w-16">Streak</th>
                </tr>
              </thead>
              <tbody>
                {sortedHabits.map(habit => {
                  const streak = getStreak(habit);
                  return (
                    <tr key={habit.id} className="border-b border-border/50 hover:bg-surface-2/50">
                      <td className="py-3 pr-4">
                        <button onClick={() => openEditModal(habit)} className="text-left">
                          <p className="text-sm font-medium text-text">{habit.name}</p>
                          {habit.time && <p className="text-xs text-text-3">{formatTime(habit.time)}</p>}
                        </button>
                      </td>
                      {weekDays.map((day, i) => {
                        const dayStr = format(day, 'yyyy-MM-dd');
                        const done = (habit.completions?.[dayStr] || 0) > 0;
                        const isFuture = isAfter(day, today) && !isSameDay(day, today);
                        const isPast = isBefore(day, today) && !isSameDay(day, today);
                        const isToday = isSameDay(day, today);

                        return (
                          <td key={i} className="py-3 text-center">
                            <button
                              onClick={() => toggleHabit(habit, dayStr)}
                              disabled={isFuture}
                              className={cn(
                                'w-8 h-8 rounded-lg flex items-center justify-center mx-auto transition-colors',
                                isFuture && 'bg-surface-3 cursor-not-allowed opacity-40',
                                done && 'bg-green-500/20',
                                !done && (isPast || isToday) && !isFuture && 'bg-red-500/10',
                              )}
                            >
                              {isFuture ? (
                                <div className="w-3 h-3 rounded-full bg-text-3/30" />
                              ) : done ? (
                                <Check size={14} className="text-green-500" />
                              ) : (
                                <X size={14} className="text-red-500/60" />
                              )}
                            </button>
                          </td>
                        );
                      })}
                      <td className="py-3 text-center">
                        <span className={cn('text-sm font-semibold', streak > 3 ? 'text-orange-500' : 'text-text-2')}>
                          {streak}{streak > 3 ? '🔥' : ''}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ──── MOBILE: Card View ──── */}
          <div className="md:hidden space-y-3">
            {sortedHabits.map(habit => {
              const streak = getStreak(habit);
              return (
                <div key={habit.id} className="bg-surface-2 rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={() => openEditModal(habit)} className="text-left flex-1">
                      <p className="text-sm font-semibold text-text">{habit.name}</p>
                    </button>
                    <span className={cn('text-sm font-semibold', streak > 3 ? 'text-orange-500' : 'text-text-2')}>
                      {streak}{streak > 3 ? '🔥' : ''}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    {weekDays.map((day, i) => {
                      const dayStr = format(day, 'yyyy-MM-dd');
                      const done = (habit.completions?.[dayStr] || 0) > 0;
                      const isFuture = isAfter(day, today) && !isSameDay(day, today);
                      const isPast = isBefore(day, today) && !isSameDay(day, today);
                      const isToday = isSameDay(day, today);

                      return (
                        <div key={i} className="flex flex-col items-center gap-1">
                          <span className="text-[10px] text-text-3">{dayLabels[i]}</span>
                          <button
                            onClick={() => toggleHabit(habit, dayStr)}
                            disabled={isFuture}
                            className={cn(
                              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors',
                              isFuture && 'bg-surface-3 cursor-not-allowed opacity-40',
                              done && 'bg-green-500/20',
                              !done && (isPast || isToday) && !isFuture && 'bg-red-500/10',
                            )}
                          >
                            {isFuture ? (
                              <div className="w-3 h-3 rounded-full bg-text-3/30" />
                            ) : done ? (
                              <Check size={14} className="text-green-500" />
                            ) : (
                              <X size={14} className="text-red-500/60" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingHabit ? 'Edit Habit' : 'New Habit'}>
        <div className="space-y-4">
          <Input label="Habit Name" value={formData.name} maxLength={100}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Morning Exercise" autoFocus />
          <Input label="Time (24h format)" type="time" value={formData.time}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, time: e.target.value })} />
          <Select label="Project" value={formData.project}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, project: e.target.value as HabitProject })}
            options={HABIT_PROJECTS.map(p => ({ value: p, label: p }))} />
          <Select label="Frequency" value={formData.frequency}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, frequency: e.target.value as HabitFrequency })}
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'specific-days', label: 'Specific Days' },
              { value: 'custom', label: 'Custom Recurrence' },
            ]} />
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-text-2">Reminder</label>
            <button
              onClick={() => setFormData({ ...formData, reminder: !formData.reminder })}
              className={cn('w-10 h-6 rounded-full transition-colors relative',
                formData.reminder ? 'bg-rise' : 'bg-surface-3')}
            >
              <div className={cn('w-4 h-4 bg-white rounded-full absolute top-1 transition-transform',
                formData.reminder ? 'translate-x-5' : 'translate-x-1')} />
            </button>
          </div>
          {formData.reminder && (
            <Select label="Reminder Time" value={formData.reminderOption}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, reminderOption: e.target.value })}
              options={[
                { value: '5-min-before', label: '5 minutes before' },
                { value: 'at-time', label: 'At time' },
                { value: '10-min-after', label: '10 minutes after' },
              ]} />
          )}
          <TextArea label="Notes (optional)" value={formData.notes}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Additional notes..." rows={2} />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSubmit} disabled={!formData.name.trim()} className="flex-1">
              {editingHabit ? 'Save Changes' : 'Save Habit'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
