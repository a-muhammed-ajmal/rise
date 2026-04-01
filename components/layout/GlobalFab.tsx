'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useCollection } from '@/lib/firestore';
import { useAuth } from '@/components/providers/AuthProvider';
import { Project } from '@/lib/types';
import TaskModal from '@/components/tasks/TaskModal';
import { cn } from '@/lib/utils';

const FAB_ACTIONS = [
  { emoji: '✅', label: 'Task',       key: 'task' },
  { emoji: '👤', label: 'Lead',       key: 'lead' },
  { emoji: '🤝', label: 'Deal',       key: 'deal' },
  { emoji: '👥', label: 'Connection', key: 'connection' },
  { emoji: '💵', label: 'Income',     key: 'income' },
  { emoji: '💳', label: 'Expense',    key: 'expense' },
  { emoji: '💪', label: 'Habit',      key: 'habit' },
  { emoji: '📄', label: 'Document',   key: 'document' },
] as const;

export default function GlobalFab() {
  const { user } = useAuth();
  const { data: projects } = useCollection<Project>('projects', user?.uid);
  const [menuOpen, setMenuOpen] = useState(false);
  const [taskModal, setTaskModal] = useState(false);

  const handleAction = (key: string) => {
    setMenuOpen(false);
    if (key === 'task') setTaskModal(true);
    // other actions: coming soon
  };

  return (
    <>
      {/* Backdrop */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Context menu — 2 rows × 4 cols */}
      {menuOpen && (
        <div className="fixed bottom-24 right-4 z-50 bg-surface rounded-2xl border border-border shadow-xl p-3 animate-slide-up">
          <div className="grid grid-cols-4 gap-1">
            {FAB_ACTIONS.map(action => (
              <button
                key={action.key}
                onClick={() => handleAction(action.key)}
                className={cn(
                  'flex flex-col items-center gap-1.5 p-3 rounded-xl transition-colors',
                  action.key === 'task'
                    ? 'hover:bg-rise/10 active:bg-rise/15'
                    : 'hover:bg-surface-2 opacity-60',
                )}
              >
                <span className="text-xl">{action.emoji}</span>
                <span className="text-[10px] font-medium text-text-2 whitespace-nowrap">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* FAB button */}
      <button
        onClick={() => setMenuOpen(o => !o)}
        className="fixed bottom-20 right-4 z-50 lg:bottom-6 w-14 h-14 rounded-full bg-rise text-white shadow-lg shadow-rise/30 flex items-center justify-center active:scale-95 transition-all"
        aria-label="Quick add"
      >
        <Plus
          size={26}
          className={cn('transition-transform duration-200', menuOpen && 'rotate-45')}
        />
      </button>

      {/* Task modal */}
      <TaskModal
        open={taskModal}
        onClose={() => setTaskModal(false)}
        projects={projects}
      />
    </>
  );
}
