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
  if (s.includes('-') && s.length === 10) return new Date(s + 'T00:00:00');
  return null;
}

function parseDueDateTime(date: string, time?: string): Date | null {
  const parsedDate = parseDueDate(date);
  if (!parsedDate) return null;
  if (!time) {
    parsedDate.setHours(23, 59, 59, 999);
    return parsedDate;
  }

  const normalized = time.trim();
  const ampmMatch = normalized.match(/(am|pm)$/i);
  const timePart = ampmMatch ? normalized.replace(/(am|pm)$/i, '').trim() : normalized;
  const [hour, minute] = timePart.split(':').map((part) => Number(part));
  if (Number.isNaN(hour) || Number.isNaN(minute)) return parsedDate;

  let normalizedHour = hour;
  if (ampmMatch) {
    const ampm = ampmMatch[1].toLowerCase();
    if (hour === 12) {
      normalizedHour = ampm === 'am' ? 0 : 12;
    } else if (ampm === 'pm') {
      normalizedHour = hour + 12;
    }
  }

  parsedDate.setHours(normalizedHour, minute, 0, 0);
  return parsedDate;
}

function formatCardDate(date: string): string {
  const parsed = parseDueDate(date);
  if (!parsed) return date;
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const d = String(parsed.getDate()).padStart(2, '0');
  const y = parsed.getFullYear();
  return `${m}/${d}/${y}`;
}

function formatTimeAMPM(time24?: string): string {
  if (!time24) return '';
  const normalized = time24.trim();
  if (normalized.match(/(am|pm)$/i)) return normalized; // Already formatted
  const [h, m] = normalized.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return time24;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
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
  const due = parseDueDateTime(dueDate, dueTime);
  if (!due) return null;
  const now = new Date();
  const today = todayMidnight();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

  let label: string;
  if (
    due.getFullYear() === today.getFullYear() &&
    due.getMonth() === today.getMonth() &&
    due.getDate() === today.getDate()
  ) {
    label = 'Today';
  } else if (
    due.getFullYear() === yesterday.getFullYear() &&
    due.getMonth() === yesterday.getMonth() &&
    due.getDate() === yesterday.getDate()
  ) {
    label = 'Yesterday';
  } else if (
    due.getFullYear() === tomorrow.getFullYear() &&
    due.getMonth() === tomorrow.getMonth() &&
    due.getDate() === tomorrow.getDate()
  ) {
    label = 'Tomorrow';
  } else {
    label = formatCardDate(dueDate);
  }

  if (dueTime) {
    label += ` ${formatTimeAMPM(dueTime)}`;
  }
  
  const color = now.getTime() < due.getTime() ? '#1ABC9C' : '#EF4444';
  return { label, color };
}

// ─── TASK CARD ────────────────────────────────────────────────────────────────

export function TaskCard({
  task,
  projects,
  onComplete,
  onEdit,
  selected,
  onSelect,
  inBulkMode,
}: {
  task: Task;
  projects: Project[];
  onComplete: (t: Task) => void;
  onEdit: (t: Task) => void;
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
        'relative flex flex-col gap-0.5 border py-2 pl-3 pr-3 rounded-md mb-2 last:mb-0',
        'active:bg-[#F5F5F5] transition-colors select-none cursor-pointer',
        selected && 'bg-[#FF6B35]/6'
      )}
      style={{ borderColor: priorityColor }}
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
              'flex-shrink-0 mt-1 w-[14px] h-[14px] rounded-full border-2 flex items-center justify-center',
              selected ? 'bg-[#FF6B35] border-[#FF6B35]' : 'border-[#AEAEB2]'
            )}
          >
            {selected && <Check size={10} strokeWidth={3} className="text-white" />}
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onComplete(task); }}
            className={cn(
              'flex-shrink-0 mt-1 w-[14px] h-[14px] rounded-full border-2 flex items-center justify-center transition-colors',
              task.isCompleted && 'bg-opacity-20'
            )}
            style={{ borderColor: priorityColor, backgroundColor: task.isCompleted ? priorityColor + '20' : 'transparent' }}
            aria-label={task.isCompleted ? 'Mark incomplete' : 'Mark complete'}
          >
            {task.isCompleted && <Check size={10} strokeWidth={3} style={{ color: priorityColor }} />}
          </button>
        )}

        <p className={cn(
          'flex-1 text-sm text-[#1C1C1E] leading-snug',
          task.isCompleted && 'line-through text-[#AEAEB2]'
        )}>
          {task.title}
        </p>
      </div>

      {/* LINE 2: Due date/time (left) + Area of Life | Target (right) */}
      {(dueDateInfo || task.realm || targetDisplay) && (
        <div className="flex items-center justify-between ml-6">
          {dueDateInfo ? (
            <span className="text-xs" style={{ color: dueDateInfo.color }}>
              {dueDateInfo.label}
            </span>
          ) : (
            <span />
          )}
          <span className="text-xs text-[#AEAEB2]">
            {targetDisplay ? `${targetDisplay} | ` : ''}{task.realm || 'Default'}
          </span>
        </div>
      )}
    </div>
  );
}
