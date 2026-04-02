'use client';

import { useRef, useState } from 'react';
import { Habit } from '@/lib/types';
import { cn, formatTime } from '@/lib/utils';
import { CheckCircle2, Circle, Clock, Tag } from 'lucide-react';
import { updateDocument, deleteDocument, addDocument } from '@/lib/firestore';
import { doc, runTransaction } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, subDays } from 'date-fns';

interface HabitCardProps {
  habit: Habit;
  userId: string;
  onEdit: (habit: Habit) => void;
}

export default function HabitCard({ habit, userId, onEdit }: HabitCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const today = format(new Date(), 'yyyy-MM-dd');
  const last7 = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), 'yyyy-MM-dd'));

  const doneToday = (habit.completions?.[today] || 0) >= habit.targetCount;

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => onEdit(habit), 600);
  };
  const clearLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const toggleComplete = async () => {
    try {
      await runTransaction(db, async (transaction) => {
        const habitRef = doc(db, 'habits', habit.id);
        const snap = await transaction.get(habitRef);
        if (!snap.exists()) return;

        const data = snap.data();
        const completions: Record<string, number> = { ...(data.completions || {}) };
        const currentCount = completions[today] || 0;

        if (currentCount > 0) {
          delete completions[today];
        } else {
          completions[today] = 1;
        }

        // Recalculate streak
        let streak = 0;
        const d = new Date();
        while (true) {
          const key = format(d, 'yyyy-MM-dd');
          if (completions[key]) {
            streak++;
            d.setDate(d.getDate() - 1);
          } else break;
        }
        const bestStreak = Math.max(streak, data.bestStreak || 0);
        transaction.update(habitRef, { completions, streak, bestStreak });
      });
    } catch (err) {
      console.error('[HabitCard] Failed to toggle habit:', err);
    }
  };

  const handleDuplicate = async () => {
    try {
      const { id: _id, createdAt, completions, ...habitData } = habit;
      await addDocument('habits', {
        ...habitData,
        isCompleted: false,
        streak: 0,
        bestStreak: 0,
        completions: {},
        order: Date.now(),
        createdAt: new Date().toISOString(),
      }, userId);
      setMenuOpen(false);
    } catch (err) {
      console.error('[HabitCard] Failed to duplicate habit:', err);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDocument('habits', habit.id);
      setMenuOpen(false);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('[HabitCard] Failed to delete habit:', err);
    }
  };

  const startDelete = () => {
    setMenuOpen(false);
    setShowDeleteConfirm(true);
  };

  // Get category display color
  const getCategoryStyle = (category: string) => {
    const colors: Record<string, string> = {
      'Morning Routine': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
      'Business Discipline': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      'Evening/Growth': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
      'Health': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      'Learning': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
      'Other': 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
    };
    return colors[category] || colors['Other'];
  };

  return (
    <div
      className={cn(
        'rounded-xl border transition-colors relative bg-surface border-border',
        doneToday ? 'opacity-75' : ''
      )}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearLongPress}
      onMouseLeave={clearLongPress}
    >
      {/* Card body */}
      <div className="p-4">
        {/* Row 1: Checkmark, Title, Time, Menu */}
        <div className="flex items-start gap-3 mb-2">
          {/* Checkmark */}
          <button onClick={toggleComplete} className="shrink-0 mt-0.5">
            {doneToday
              ? <CheckCircle2 size={22} style={{ color: habit.color }} />
              : <Circle size={22} style={{ color: habit.color }} />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className={cn('text-sm font-semibold leading-snug', doneToday ? 'line-through text-text-3' : 'text-text')}>
                {habit.name}
              </p>
            </div>

            {habit.description && (
              <p className="text-xs text-text-3 mb-1.5 line-clamp-2">{habit.description}</p>
            )}

            {/* Description, Time, Category */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {habit.time && (
                <span className="flex items-center gap-1 text-text-3">
                  <Clock size={12} />
                  {formatTime(habit.time)}
                </span>
              )}
              {habit.category && (
                <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium', getCategoryStyle(habit.category))}>
                  {habit.category}
                </span>
              )}
            </div>

            {/* Streak */}
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1 text-xs font-medium" style={{ color: habit.color }}>
                <span className="text-orange-500">🔥</span> {habit.streak || 0} day streak
              </span>
              <span className="flex items-center gap-1 text-xs text-text-3">
                <span className="text-yellow-500">🏆</span> Best: {habit.bestStreak || 0}
              </span>
            </div>
          </div>

          {/* Menu */}
          <div className="relative shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="p-1 text-text-3 hover:text-text rounded"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
              </svg>
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-6 z-20 w-36 bg-surface rounded-lg border border-border shadow-lg py-1">
                  <button
                    onClick={() => { setMenuOpen(false); onEdit(habit); }}
                    className="w-full px-3 py-2 text-left text-xs text-text hover:bg-surface-2 transition-colors"
                  >
                    Edit Habit
                  </button>
                  <button
                    onClick={handleDuplicate}
                    className="w-full px-3 py-2 text-left text-xs text-text hover:bg-surface-2 transition-colors"
                  >
                    Duplicate
                  </button>
                  <button
                    onClick={startDelete}
                    className="w-full px-3 py-2 text-left text-xs text-red-500 hover:bg-red-50 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 7-day activity */}
        <div className="flex gap-2.5 mt-3 justify-center">
          {last7.map(day => {
            const done = (habit.completions?.[day] || 0) > 0;
            return (
              <div key={day} className="flex flex-col items-center gap-1">
                <div
                  className={cn('w-7 h-7 rounded-full border-2 flex items-center justify-center transition-colors',
                    done ? 'border-green-500 bg-green-500' : 'border-border bg-surface-3')}
                  style={doneToday && done ? { borderColor: habit.color, backgroundColor: habit.color } : {}}
                >
                  {done && <CheckCircle2 size={12} className="text-white" />}
                </div>
                <span className="text-[10px] text-text-3">{format(new Date(day), 'EEE').charAt(0)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
            <div className="bg-surface rounded-xl border border-border p-4 max-w-[280px] w-[90%] animate-in fade-in zoom-in duration-150">
              <p className="text-sm text-text mb-4">Delete this habit?</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 px-3 rounded-lg border border-border text-xs font-medium text-text-3 hover:bg-surface-2 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2 px-3 rounded-lg bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
