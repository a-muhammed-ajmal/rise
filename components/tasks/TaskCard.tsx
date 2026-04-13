'use client';

import { useRef } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task, Project } from '@/lib/types';

// ─── PRIORITY COLORS (per spec) ───────────────────────────────────────────────
const CARD_PRIORITY_COLORS: Record<string, string> = {
  P1: '#EF4444',
  P2: '#3B82F6',
  P3: '#F59E0B',
  P4: '#6B7280',
};

// ─── DATE HELPERS ─────────────────────────────────────────────────────────────

function parseDueDate(s: string): Date | null {
  if (!s) return null;
  if (s.includes('/')) {
    const [d, m, y] = s.split('/').map(Number);
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y, m - 1, d);
  }
  // Legacy YYYY-MM-DD
  if (s.includes('-') && s.length === 10) return new Date(s + 'T00:00:00');
  return null;
}

function todayMidnight(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

interface DueDateInfo {
  label: string;
  color: string;
}

function getDueDateInfo(dueDate: string | undefined, dueTime: string | undefined): DueDateInfo | null {
  if (!dueDate) return null;
  const parsed = parseDueDate(dueDate);
  if (!parsed) return null;
  const today = todayMidnight();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const ts = parsed.getTime();

  let label: string;
  let color: string;

  if (ts === today.getTime()) {
    label = 'Today';
    color = '#1C1C1E';
  } else if (ts === yesterday.getTime()) {
    label = 'Yesterday';
    color = '#EF4444';
  } else if (ts === tomorrow.getTime()) {
    label = 'Tomorrow';
    color = '#1ABC9C';
  } else if (ts < today.getTime()) {
    // Past — show DD/MM/YYYY in red
    label = dueDate.includes('/') ? dueDate : dueDate.split('-').reverse().join('/');
    color = '#EF4444';
  } else {
    // Future — show DD/MM/YYYY in muted green
    label = dueDate.includes('/') ? dueDate : dueDate.split('-').reverse().join('/');
    color = '#1ABC9C';
  }

  if (dueTime) label += ` ${dueTime}`;
  return { label, color };
}

// ─── TASK CARD ────────────────────────────────────────────────────────────────

export function TaskCard({
  task,
  projects,
  onComplete,
  onEdit,
  onDelete: _onDelete,
  onDuplicate: _onDuplicate,
  selected,
  onSelect,
  inBulkMode,
}: {
  task: Task;
  projects: Project[];
  onComplete: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onDuplicate: (t: Task) => void;
  selected: boolean;
  onSelect: (t: Task) => void;
  inBulkMode: boolean;
}) {
  const priorityColor = CARD_PRIORITY_COLORS[task.priority] ?? '#6B7280';
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMoved = useRef(false);

  const targetProject = projects.find((p) => p.id === (task.targetId ?? task.projectId));
  const targetTitle = targetProject?.title ?? '';
  const targetDisplay = targetTitle.length > 15 ? targetTitle.slice(0, 15) + '...' : targetTitle;

  const dueDateInfo = getDueDateInfo(task.dueDate, task.dueTime);

  const handlePointerDown = () => {
    touchMoved.current = false;
    longPressRef.current = setTimeout(() => {
      if (!touchMoved.current) onSelect(task);
    }, 600);
  };
  const handlePointerMove = () => { touchMoved.current = true; };
  const handlePointerUp = () => {
    if (longPressRef.current) clearTimeout(longPressRef.current);
  };

  const handleCardClick = () => {
    if (inBulkMode) { onSelect(task); return; }
    onEdit(task);
  };

  return (
    <div
      className={cn(
        'relative flex flex-col gap-0.5 border-l-4 py-2 pl-3 pr-3',
        'border-b border-b-[#E5E5EA] last:border-b-0',
        'active:bg-[#F5F5F5] transition-colors select-none cursor-pointer',
        selected && 'bg-[#FF6B35]/6'
      )}
      style={{ borderLeftColor: priorityColor }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleCardClick}
    >
      {/* LINE 1: Completion circle + title */}
      <div className="flex items-start gap-2">
        {inBulkMode ? (
          <div
            className={cn(
              'flex-shrink-0 mt-0.5 w-6 h-6 rounded-full border-2 flex items-center justify-center',
              selected ? 'bg-[#FF6B35] border-[#FF6B35]' : 'border-[#AEAEB2]'
            )}
          >
            {selected && <Check size={14} className="text-white" />}
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onComplete(task); }}
            className={cn(
              'flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
              task.isCompleted && 'bg-opacity-20'
            )}
            style={{ borderColor: priorityColor, backgroundColor: task.isCompleted ? priorityColor + '20' : 'transparent' }}
            aria-label={task.isCompleted ? 'Mark incomplete' : 'Mark complete'}
          >
            {task.isCompleted && <Check size={12} style={{ color: priorityColor }} />}
          </button>
        )}

        <p className={cn(
          'flex-1 text-sm text-[#1C1C1E] leading-snug',
          task.isCompleted && 'line-through text-[#AEAEB2]'
        )}>
          {task.title}
        </p>
      </div>

      {/* LINE 2: Due date (left) + Realm name (right) — left-aligned under title */}
      {(dueDateInfo || task.realm) && (
        <div className="flex items-center justify-between ml-10">
          {dueDateInfo ? (
            <span className="text-xs" style={{ color: dueDateInfo.color }}>
              {dueDateInfo.label}
            </span>
          ) : <span />}
          {task.realm && (
            <span className="text-xs text-[#AEAEB2]">
              {task.realm}
            </span>
          )}
        </div>
      )}

      {/* LINE 3: Target title — only if targetId set */}
      {(task.targetId || task.projectId) && targetDisplay && (
        <p className="text-xs text-[#AEAEB2] ml-10">{targetDisplay}</p>
      )}
    </div>
  );
}
