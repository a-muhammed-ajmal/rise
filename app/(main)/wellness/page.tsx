'use client';

import { useState, useEffect, type ChangeEvent } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection, addDocument, updateDocument } from '@/lib/firestore';
import { Habit, HABIT_CATEGORIES, type HabitFrequency } from '@/lib/types';
import { cn, formatTime } from '@/lib/utils';
import { Activity, Plus, Flame } from 'lucide-react';
import { format } from 'date-fns';
import HabitCard from '@/components/wellness/HabitCard';
import PomodoroTimer from '@/components/wellness/PomodoroTimer';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input, Select, TextArea } from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';

const PRESET_COLORS = ['#FF9933', '#DC4C3E', '#4073FF', '#2D7C3E', '#7B4B9E', '#E8849B', '#4A9B8E', '#F49C18', '#10B981', '#EF4444'];
const PRESET_ICONS = ['💪', '🏃', '🧘', '📚', '💧', '🥗', '💤', '✍️', '🎯', '💡', '🔥', '⭐', '🌟', '💝', '🎵', '📱', '💻', '🏢', '💰', '📊'];

export default function WellnessPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: habits, loading } = useCollection<Habit>('habits', uid, 'order');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    icon: string;
    color: string;
    category: typeof HABIT_CATEGORIES[number];
    time: string;
    frequency: HabitFrequency;
  }>({
    name: '',
    description: '',
    icon: '💪',
    color: PRESET_COLORS[0],
    category: HABIT_CATEGORIES[0],
    time: '',
    frequency: 'daily',
  });

  // Reset form when modal closes or editing changes
  useEffect(() => {
    if (!modalOpen) {
      setEditingHabit(null);
      setFormData({
        name: '',
        description: '',
        icon: '💪',
        color: PRESET_COLORS[0],
        category: HABIT_CATEGORIES[0] as any,
        time: '',
        frequency: 'daily',
      });
    }
  }, [modalOpen]);

  const openAddModal = () => {
    setEditingHabit(null);
    setFormData({
      name: '',
      description: '',
      icon: '💪',
      color: PRESET_COLORS[0],
      category: HABIT_CATEGORIES[0] as any,
      time: '',
      frequency: 'daily',
    });
    setModalOpen(true);
  };

  const openEditModal = (habit: Habit) => {
    setEditingHabit(habit);
    setFormData({
      name: habit.name,
      description:habit.description || '',
      icon: habit.icon,
      color: habit.color,
      category: habit.category as any,
      time: habit.time || '',
      frequency: habit.frequency,
    });
    setModalOpen(true);
  };

  const seedDefaultHabits = async () => {
    if (!user) return;
    try {
      const defaultHabits = [
        { name: 'Start day at 6 am', description: 'Start the day strong', time: '06:00', category: 'Morning Routine' as const, icon: '🌅', color: PRESET_COLORS[0] },
        { name: 'Drink 1 full glass of water', description: 'Stay hydrated from the start', time: '06:35', category: 'Morning Routine' as const, icon: '💧', color: PRESET_COLORS[1] },
        { name: 'Read my positive affirmation', description: 'Focus on positivity', time: '06:40', category: 'Morning Routine' as const, icon: '📖', color: PRESET_COLORS[2] },
        { name: 'Morning Exercise', description: 'Get the body moving', time: '07:00', category: 'Morning Routine' as const, icon: '🏃', color: PRESET_COLORS[3] },
        { name: 'Deep breath exercise', description: 'Center yourself', time: '07:15', category: 'Morning Routine' as const, icon: '🧘', color: PRESET_COLORS[4] },
        { name: 'Meditate for 3 minutes', description: 'Clear your mind', time: '07:25', category: 'Morning Routine' as const, icon: '✨', color: PRESET_COLORS[5] },
        { name: 'Listen educational video', description: 'Learn something new', time: '07:30', category: 'Morning Routine' as const, icon: '📺', color: PRESET_COLORS[6] },
        { name: 'Follow-ups with leads', description: 'Keep the pipeline moving', time: '09:00', category: 'Business Discipline' as const, icon: '📞', color: PRESET_COLORS[7] },
        { name: 'Meet 50 new customers', description: 'Expand your network', time: '10:00', category: 'Business Discipline' as const, icon: '🤝', color: PRESET_COLORS[8] },
        { name: 'Set out things for the next day', description: 'Prepare for tomorrow', time: '22:00', category: 'Evening/Growth' as const, icon: '📅', color: PRESET_COLORS[9] },
        { name: 'Evening Review', description: 'Reflect on the day', time: '22:15', category: 'Evening/Growth' as const, icon: '📝', color: PRESET_COLORS[0] },
        { name: 'Define the MIT for tomorrow', description: 'Identify Most Important Task', time: '22:30', category: 'Evening/Growth' as const, icon: '🎯', color: PRESET_COLORS[1] },
      ];

      for (const habit of defaultHabits) {
        await addDocument('habits', {
          name: habit.name,
          description: habit.description,
          icon: habit.icon,
          color: habit.color,
          category: habit.category,
          time: habit.time,
          frequency: 'daily',
          targetCount: 1,
          completions: {},
          streak: 0,
          bestStreak: 0,
          isActive: true,
          order: Date.now() + Math.random(),
        } as Partial<Habit>, user.uid);
      }
      // Reload to refresh
      window.location.reload();
    } catch (err) {
      console.error('[Wellness] Failed to seed habits:', err);
      alert('Failed to add default habits. Please try again.');
    }
  };

  const handleSubmit = async () => {
    if (!user || !formData.name.trim()) return;

    try {
      if (editingHabit) {
        await updateDocument('habits', editingHabit.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          icon: formData.icon,
          color: formData.color,
          category: formData.category,
          time: formData.time || undefined,
          frequency: formData.frequency,
        });
      } else {
        await addDocument('habits', {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          icon: formData.icon,
          color: formData.color,
          category: formData.category,
          time: formData.time || undefined,
          frequency: formData.frequency,
          targetCount: 1,
          completions: {},
          streak: 0,
          bestStreak: 0,
          isActive: true,
          order: Date.now(),
        } as Partial<Habit>, user.uid);
      }
      setModalOpen(false);
      // Refresh by reloading page (simple approach)
      window.location.reload();
    } catch (err) {
      console.error('[Wellness] Failed to save habit:', err);
    }
  };

  // Group habits by time for timeline view
  const sortedHabits = [...(habits || [])].sort((a, b) => {
    if (!a.time && !b.time) return a.name.localeCompare(b.name);
    if (!a.time) return 1;
    if (!b.time) return -1;
    return a.time.localeCompare(b.time);
  });

  // Group by time of day for better organization
  const morningHabits = sortedHabits.filter(h => !h.time || parseTime(h.time) < 12 * 60);
  const afternoonHabits = sortedHabits.filter(h => {
    if (!h.time) return false;
    const minutes = parseTime(h.time);
    return minutes >= 12 * 60 && minutes < 17 * 60;
  });
  const eveningHabits = sortedHabits.filter(h => {
    if (!h.time) return false;
    const minutes = parseTime(h.time);
    return minutes >= 17 * 60;
  });

  function parseTime(timeStr: string): number {
    if (!timeStr) return 24 * 60; // Place at end if no time
    const [hour, minute] = timeStr.split(':').map(Number);
    return (hour || 0) * 60 + (minute || 0);
  }

  const renderHabitGroup = (title: string, groupHabits: Habit[]) => {
    if (groupHabits.length === 0) return null;
    return (
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-text-2 mb-3 uppercase tracking-wide">{title}</h3>
        <div className="space-y-3">
          {groupHabits.map(habit => (
            <HabitCard key={habit.id} habit={habit} userId={uid!} onEdit={openEditModal} />
          ))}
        </div>
      </div>
    );
  };

  // Stats
  const totalHabits = habits?.length || 0;
  const today = format(new Date(), 'yyyy-MM-dd');
  const completedToday = habits?.filter(h => (h.completions?.[today] || 0) > 0).length || 0;
  const avgStreak = totalHabits > 0
    ? Math.round(habits.reduce((sum, h) => sum + (h.streak || 0), 0) / totalHabits)
    : 0;

  return (
    <div className="px-4 py-6 lg:px-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-text">Wellness</h1>
          <p className="text-sm text-text-3 mt-1">
            {completedToday}/{totalHabits} completed today · Avg streak: {avgStreak} days
          </p>
        </div>
        <button onClick={openAddModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-rise text-[#0A0A0F] rounded-xl text-sm font-semibold shadow-sm hover:bg-rise/90 transition-colors">
          <Plus size={18} /> New Habit
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">{[1, 2, 3].map(i => <div key={i} className="h-28 rounded-2xl bg-surface-2 animate-pulse" />)}</div>
      ) : totalHabits === 0 ? (
        <EmptyState
          icon={Activity}
          title="No habits yet"
          description="Start building consistent habits to improve your wellness journey"
          action={
            <div className="flex flex-col gap-3 w-full max-w-xs">
              <Button onClick={openAddModal} className="w-full"><Plus size={18} /> Create Custom Habit</Button>
              <Button onClick={seedDefaultHabits} variant="secondary" className="w-full">
                <Flame size={18} /> Add Default Routine
              </Button>
            </div>
          }
        />
      ) : (
        <div>
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-surface-2 rounded-xl p-4 border border-border text-center">
              <div className="text-2xl font-bold" style={{ color: PRESET_COLORS[0] }}>{totalHabits}</div>
              <div className="text-xs text-text-3 mt-1">Total</div>
            </div>
            <div className="bg-surface-2 rounded-xl p-4 border border-border text-center">
              <div className="text-2xl font-bold text-green-500">{completedToday}</div>
              <div className="text-xs text-text-3 mt-1">Done Today</div>
            </div>
            <div className="bg-surface-2 rounded-xl p-4 border border-border text-center">
              <div className="text-2xl font-bold text-orange-500">{avgStreak}</div>
              <div className="text-xs text-text-3 mt-1">Avg Streak</div>
            </div>
          </div>

          {/* Pomodoro Timer */}
          <PomodoroTimer userId={uid!} />

          {/* Timeline View */}
          {renderHabitGroup('🌅 Morning', morningHabits.filter(h => h.time))}
          {renderHabitGroup('☀️ Afternoon', afternoonHabits.filter(h => h.time))}
          {renderHabitGroup('🌙 Evening', eveningHabits.filter(h => h.time))}

          {/* Unscheduled habits */}
          {sortedHabits.filter(h => !h.time).length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-text-2 mb-3 uppercase tracking-wide">📅 Anytime</h3>
              <div className="space-y-3">
                {sortedHabits.filter(h => !h.time).map(habit => (
                  <HabitCard key={habit.id} habit={habit} userId={uid!} onEdit={openEditModal} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingHabit ? 'Edit Habit' : 'New Habit'}>
        <div className="space-y-4">
          <Input
            label="Habit Name"
            value={formData.name}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g. Morning Exercise"
            autoFocus
          />

          <TextArea
            label="Description (optional)"
            value={formData.description}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Add a description..."
            rows={2}
          />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-2">Icon</label>
              <div className="grid grid-cols-6 gap-2 p-2 border border-border rounded-lg max-h-40 overflow-y-auto">
                {PRESET_ICONS.map(icon => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon })}
                    className={cn(
                      'text-xl p-1.5 rounded-md transition-all',
                      formData.icon === icon ? 'bg-rise/20 ring-2 ring-rise' : 'hover:bg-surface-2'
                    )}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-2">Color</label>
              <div className="grid grid-cols-4 gap-2 p-2 border border-border rounded-lg">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: c })}
                    className={cn(
                      'w-8 h-8 rounded-full border-2 transition-all',
                      formData.color === c ? 'border-text scale-110' : 'border-transparent'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Category"
              value={formData.category}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, category: e.target.value as typeof HABIT_CATEGORIES[number] })}
              options={HABIT_CATEGORIES.map(cat => ({ value: cat, label: cat }))}
            />

            <Input
              label="Time (24h format)"
              type="time"
              value={formData.time}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, time: e.target.value })}
            />
          </div>

          <Select
            label="Frequency"
            value={formData.frequency}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, frequency: e.target.value as HabitFrequency })}
            options={[
              { value: 'daily', label: 'Daily' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'custom', label: 'Custom' },
            ]}
          />

          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name.trim()} className="flex-1">
              {editingHabit ? 'Save Changes' : 'Create Habit'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
