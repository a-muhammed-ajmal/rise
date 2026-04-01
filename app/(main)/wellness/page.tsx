'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useCollection, addDocument, deleteDocument } from '@/lib/firestore';
import { db } from '@/lib/firebase';
import { runTransaction, doc } from 'firebase/firestore';
import { Habit } from '@/lib/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import { Plus, Flame, Trophy, Trash2, Activity, Check } from 'lucide-react';
import { format, subDays } from 'date-fns';

const PRESET_COLORS = ['#FF9933', '#DC4C3E', '#4073FF', '#2D7C3E', '#7B4B9E', '#E8849B', '#4A9B8E', '#F49C18'];

export default function WellnessPage() {
  const { user } = useAuth();
  const uid = user?.uid;
  const { data: habits, loading } = useCollection<Habit>('habits', uid, 'order');
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('💪');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'custom'>('daily');

  const today = format(new Date(), 'yyyy-MM-dd');
  const last7 = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'));

  const toggleToday = async (habit: Habit) => {
    const habitRef = doc(db, 'habits', habit.id);
    // Use a Firestore transaction so rapid double-taps read the latest server
    // state before writing — prevents streak corruption from stale local state.
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(habitRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const completions: Record<string, number> = { ...(data.completions || {}) };
      if ((completions[today] || 0) > 0) {
        delete completions[today];
      } else {
        completions[today] = 1;
      }
      // Re-calculate streak from the freshly-read completions map
      let streak = 0;
      const d = new Date();
      while (true) {
        const key = format(d, 'yyyy-MM-dd');
        if (completions[key]) { streak++; d.setDate(d.getDate() - 1); }
        else break;
      }
      const bestStreak = Math.max(streak, data.bestStreak || 0);
      transaction.update(habitRef, { completions, streak, bestStreak });
    });
  };

  const handleAdd = async () => {
    if (!name.trim() || !user) return;
    await addDocument('habits', {
      name: name.trim(), icon, color, frequency,
      customDays: [], targetCount: 1, completions: {},
      streak: 0, bestStreak: 0, isActive: true, order: Date.now(),
    } as Partial<Habit>, user.uid);
    setName(''); setIcon('💪');
    setModalOpen(false);
  };

  return (
    <div className="px-4 py-6 lg:px-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold text-text">Wellness</h1>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-rise text-white rounded-xl text-sm font-semibold shadow-sm">
          <Plus size={18} /> New Habit
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">{[1,2].map(i => <div key={i} className="h-28 rounded-2xl bg-surface-2 animate-pulse" />)}</div>
      ) : habits.length === 0 ? (
        <EmptyState icon={Activity} title="No habits yet" description="Build consistency with daily habits" />
      ) : (
        <div className="space-y-3">
          {habits.map(habit => {
            const doneToday = (habit.completions?.[today] || 0) > 0;
            return (
              <div key={habit.id} className="bg-surface-2 rounded-2xl p-5 border border-border">
                <div className="flex items-center gap-4">
                  <button onClick={() => toggleToday(habit)}
                    className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 border-2 transition-all',
                      doneToday ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-border bg-surface-3')}>
                    {doneToday ? <Check size={24} className="text-green-500" /> : <span>{habit.icon}</span>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-text">{habit.name}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs font-medium text-orange-500">
                        <Flame size={14} /> {habit.streak || 0} streak
                      </span>
                      <span className="flex items-center gap-1 text-xs text-text-3">
                        <Trophy size={12} /> Best: {habit.bestStreak || 0}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => deleteDocument('habits', habit.id)} className="text-text-3 hover:text-red-500 p-1">
                    <Trash2 size={16} />
                  </button>
                </div>
                {/* 7-day dots */}
                <div className="flex gap-2 mt-3 justify-center">
                  {last7.map(day => {
                    const done = (habit.completions?.[day] || 0) > 0;
                    return (
                      <div key={day} className="flex flex-col items-center gap-1">
                        <div className={cn('w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors',
                          done ? 'border-green-500 bg-green-500' : 'border-border bg-surface-3')}>
                          {done && <Check size={14} className="text-white" />}
                        </div>
                        <span className="text-[10px] text-text-3">{format(new Date(day), 'EEE').charAt(0)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Habit">
        <div className="space-y-4">
          <Input label="Habit Name" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning Exercise" autoFocus />
          <Input label="Icon (emoji)" value={icon} onChange={e => setIcon(e.target.value)} placeholder="💪" />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-2">Color</label>
            <div className="flex gap-2">
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={cn('w-8 h-8 rounded-full border-2 transition-all', color === c ? 'border-text scale-110' : 'border-transparent')}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <Select label="Frequency" value={frequency} onChange={e => setFrequency(e.target.value as 'daily' | 'weekly' | 'custom')}
            options={[{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'custom', label: 'Custom' }]} />
          <div className="flex gap-3 pt-4">
            <Button variant="secondary" onClick={() => setModalOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleAdd} disabled={!name.trim()} className="flex-1">Create</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
