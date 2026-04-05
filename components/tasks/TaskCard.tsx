'use client';

import { useRef, useState, useEffect } from 'react';
import { Task, Project, LIFE_AREAS, PRIORITY_CONFIG, GTD_CONFIG, QUADRANT_CONFIG } from '@/lib/types';
import { cn, formatDate } from '@/lib/utils';
import { CheckCircle2, Circle } from 'lucide-react';
import { updateDocument, deleteDocument, addDocument } from '@/lib/firestore';
import { addDays, addMonths, parseISO, isValid, format } from 'date-fns';

interface TaskCardProps {
  task: Task;
  projects: Project[];
  userId: string;
  onEdit: (task: Task) => void;
  selected?: boolean;
  onSelect?: (id: string) => void;
  selectionMode?: boolean;
}

export default function TaskCard({
  task, projects, userId, onEdit, selected, onSelect, selectionMode,
}: TaskCardProps) {
  const priorityCfg = PRIORITY_CONFIG[task.priority];
  const area = LIFE_AREAS.find(a => a.id === task.area);
  const project = projects.find(p => p.id === task.projectId);
  const projectArea = project ? LIFE_AREAS.find(a => a.id === project.area) : null;
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  const handleTouchStart = () => {
    longPressTimer.current = setTimeout(() => onSelect?.(task.id), 600);
  };
  const clearLongPress = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  const toggleComplete = async () => {
    try {
      const done = !task.isCompleted;
      await updateDocument('tasks', task.id, {
        isCompleted: done,
        completedAt: done ? new Date().toISOString() : null,
      });
      // Auto-create next recurring instance
      if (done && task.recurring && task.recurring !== 'None' && task.dueDate) {
        const base = parseISO(task.dueDate);
        if (!isValid(base)) return;
        const next =
          task.recurring === 'Daily'   ? addDays(base, 1)
          : task.recurring === 'Weekly'  ? addDays(base, 7)
          : task.recurring === 'Monthly' ? addMonths(base, 1)
          : addDays(base, 365);
        const { id: _id, completedAt: _ca, ...taskData } = task;
        await addDocument('tasks', {
          ...taskData,
          isCompleted: false,
          dueDate: format(next, 'yyyy-MM-dd'),
          order: Date.now(),
        }, userId);
      }
    } catch (err) {
      console.error('[TaskCard] Failed to toggle task:', err);
    }
  };

  const handleDuplicate = async () => {
    try {
      const { id: _id, createdAt, completedAt, ...taskData } = task;
      await addDocument('tasks', {
        ...taskData,
        isCompleted: false,
        order: Date.now(),
        createdAt: new Date().toISOString(),
      }, userId);
      setMenuOpen(false);
    } catch (err) {
      console.error('[TaskCard] Failed to duplicate task:', err);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDocument('tasks', task.id);
      setMenuOpen(false);
      setShowDeleteConfirm(false);
    } catch (err) {
      console.error('[TaskCard] Failed to delete task:', err);
    }
  };

  const startDelete = () => {
    setMenuOpen(false);
    setShowDeleteConfirm(true);
  };

  // Recurring letter
  const getRecurringLetter = () => {
    if (!task.recurring || task.recurring === 'None') return null;
    const letter = task.recurring[0]; // D, W, M, Y
    return letter;
  };

  // Target/Realm label (max 15 chars, separator is |)
  const targetRealmLabel = project
    ? `${project.title.length > 15 ? project.title.slice(0, 15) + '..' : project.title} | ${area?.name ?? 'Inbox'}`
    : area?.name ?? 'Inbox';

  return (
    <div
      className={cn(
        'rounded-xl border transition-colors relative',
        selected ? 'border-rise/50' : 'border-border'
      )}
      style={{ borderColor: priorityCfg.color }}
      onTouchStart={handleTouchStart}
      onTouchEnd={clearLongPress}
      onMouseLeave={clearLongPress}
    >
      {/* Card body - no action */}
      <div className="p-3">
        {/* Row 1: Checkmark, Title, Three-dot menu */}
        <div className="flex items-start gap-2.5 mb-2">
          {/* Checkmark */}
          <button onClick={toggleComplete} className="shrink-0 mt-0.5">
            {task.isCompleted
              ? <CheckCircle2 size={18} style={{ color: priorityCfg.color }} />
              : <Circle size={18} style={{ color: priorityCfg.color }} />}
          </button>

          {/* Title */}
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm font-medium leading-snug', task.isCompleted ? 'line-through text-text-3' : 'text-text')}>
              {task.title}
            </p>
          </div>

          {/* Three-dot menu */}
          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 text-text-3 hover:text-text rounded"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="19" cy="12" r="1.5" />
              </svg>
            </button>

            {/* Dropdown */}
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 top-6 z-20 w-36 bg-surface-2 rounded-lg border border-white/[0.08] shadow-xl shadow-black/60 py-1">
                  <button
                    onClick={() => { setMenuOpen(false); onEdit(task); }}
                    className="w-full px-3 py-2 text-left text-xs text-text hover:bg-white/5 transition-colors"
                  >
                    Edit Action
                  </button>
                  <button
                    onClick={handleDuplicate}
                    className="w-full px-3 py-2 text-left text-xs text-text hover:bg-white/5 transition-colors"
                  >
                    Duplicate Action
                  </button>
                  <button
                    onClick={startDelete}
                    className="w-full px-3 py-2 text-left text-xs text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    Delete Action
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Row 2: GTD Context | Quadrant | Date & Time | Recurring | Project/Area */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs text-text-3">
          {/* GTD Context badge */}
          {task.gtdContext && GTD_CONFIG[task.gtdContext] && (
            <span
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white shrink-0"
              style={{ backgroundColor: GTD_CONFIG[task.gtdContext].color }}
            >
              {GTD_CONFIG[task.gtdContext].title}
            </span>
          )}

          {/* Quadrant badge */}
          {task.quadrant && QUADRANT_CONFIG[task.quadrant] && (
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
              style={{ backgroundColor: QUADRANT_CONFIG[task.quadrant].color + '20', color: QUADRANT_CONFIG[task.quadrant].color }}
            >
              {QUADRANT_CONFIG[task.quadrant].title}
            </span>
          )}

          {/* Date & Time */}
          {task.dueDate && (
            <span className="truncate min-w-0">
              {formatDate(task.dueDate)}{task.dueTime ? ` · ${task.dueTime}` : ''}
            </span>
          )}

          {/* Recurring - minimal letter only */}
          {getRecurringLetter() && (
            <span className="text-[10px] font-medium text-text-3 shrink-0">
              {getRecurringLetter()}
            </span>
          )}

          {/* Spacer to push target/realm right */}
          <div className="flex-1" />

          {/* Target/Realm (right) */}
          <div className="flex items-center gap-1 truncate shrink-0 min-w-0 max-w-[40%]">
            <span className="truncate">{targetRealmLabel}</span>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowDeleteConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-surface-2 rounded-xl border border-white/[0.08] p-4 max-w-[280px] w-[90%] animate-scale-in">
              <p className="text-sm text-text mb-4">Are you sure you want to delete this action?</p>
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
