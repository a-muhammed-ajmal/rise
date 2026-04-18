'use client';

import { useRef, useState, useEffect } from 'react';
import { Check, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task, Project } from '@/lib/types';

// ─── PRIORITY COLORS (per spec §17.2) ────────────────────────────────────────
const CARD_PRIORITY_COLORS: Record<string, string> = {
  P1: '#EF4444',
  P2: '#F59E0B',
  P3: '#3B82F6',
  P4: '#6B7280',
};

// Priority label names per spec §9.2 TaskModal
const PRIORITY_LABELS: Record<string, string> = {
  P1: 'P1',
  P2: 'P2',
  P3: 'P3',
  P4: 'P4',
};

// Recurring letter badges per spec §9.2
const RECURRING_LETTER: Record<string, string> = {
  Daily: 'D',
  Weekdays: 'W',
  Weekly: 'W',
  Monthly: 'M',
  Yearly: 'Y',
  Custom: 'C',
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
  const d = String(parsed.getDate()).padStart(2, '0');
  const m = String(parsed.getMonth() + 1).padStart(2, '0');
  const y = parsed.getFullYear();
  return `${d}/${m}/${y}`;
}

function formatTimeAMPM(time24?: string): string {
  if (!time24) return '';
  const normalized = time24.trim();
  if (normalized.match(/(am|pm)$/i)) return normalized;
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

  // separator · between date and time per spec §9.2
  if (dueTime) {
    label += ` · ${formatTimeAMPM(dueTime)}`;
  }

  const color = now.getTime() < due.getTime() ? '#1ABC9C' : '#EF4444';
  return { label, color };
}

// ─── THREE-DOT MENU ───────────────────────────────────────────────────────────

function ThreeDotMenu({
  onEdit,
  onDuplicate,
  onDelete,
}: {
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="w-7 h-7 flex items-center justify-center rounded-full text-[#AEAEB2] hover:text-[#6C6C70] hover:bg-[#F2F2F7] transition-colors"
        aria-label="More options"
      >
        <MoreVertical size={15} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-8 z-50 w-40 bg-white rounded-xl border border-[#E5E5EA] shadow-lg py-1 overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => { setOpen(false); onEdit(); }}
            className="w-full text-left px-4 py-2.5 text-[13px] text-[#1C1C1E] hover:bg-[#F5F5F5] transition-colors"
          >
            Edit Action
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onDuplicate(); }}
            className="w-full text-left px-4 py-2.5 text-[13px] text-[#1C1C1E] hover:bg-[#F5F5F5] transition-colors"
          >
            Duplicate Action
          </button>
          <div className="h-px bg-[#E5E5EA] mx-2" />
          <button
            type="button"
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full text-left px-4 py-2.5 text-[13px] text-[#EF4444] hover:bg-[#FFF0F0] transition-colors"
          >
            Delete Action
          </button>
        </div>
      )}
    </div>
  );
}

// ─── TASK CARD ────────────────────────────────────────────────────────────────

export function TaskCard({
  task,
  projects,
  onComplete,
  onEdit,
  onMenuEdit,
  onDuplicate,
  onDelete,
  selected,
  onSelect,
  inBulkMode,
}: {
  task: Task;
  projects: Project[];
  onComplete: (t: Task) => void;
  onEdit: (t: Task) => void;
  onMenuEdit?: (t: Task) => void;
  onDuplicate?: (t: Task) => void;
  onDelete?: (t: Task) => void;
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
  const recurringLetter = task.recurring && task.recurring !== 'None'
    ? RECURRING_LETTER[task.recurring] ?? null
    : null;

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
        'relative flex flex-col gap-0.5 py-2 pl-3 pr-2 rounded-xl mb-2 last:mb-0',
        'bg-white shadow-sm border border-[#E5E5EA] border-l-4',
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
      {/* LINE 1: Completion circle + title + three-dot menu */}
      <div className="flex items-center gap-0">
        {inBulkMode ? (
          <div className="flex-shrink-0 -mt-0.5 -ml-1 w-[36px] h-[36px] flex items-center justify-center">
            <div
              className={cn(
                'w-[16px] h-[16px] rounded-full border-2 flex items-center justify-center',
                selected ? 'bg-[#FF6B35] border-[#FF6B35]' : 'border-[#AEAEB2]'
              )}
            >
              {selected && <Check size={10} strokeWidth={3} className="text-white" />}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onComplete(task); }}
            className="flex-shrink-0 -mt-0.5 -ml-1 w-[36px] h-[36px] flex items-center justify-center transition-colors"
            aria-label={task.isCompleted ? 'Mark incomplete' : 'Mark complete'}
          >
            <div
              className={cn(
                'w-[16px] h-[16px] rounded-full border-2 flex items-center justify-center transition-colors',
                task.isCompleted && 'bg-opacity-20'
              )}
              style={{ borderColor: priorityColor, backgroundColor: task.isCompleted ? priorityColor + '20' : 'transparent' }}
            >
              {task.isCompleted && <Check size={10} strokeWidth={3} style={{ color: priorityColor }} />}
            </div>
          </button>
        )}

        <p className={cn(
          'flex-1 text-sm text-[#1C1C1E] leading-snug pr-1',
          task.isCompleted && 'line-through text-[#AEAEB2]'
        )}>
          {task.title}
        </p>

        {/* Three-dot menu — only shown when not in bulk mode and handlers provided */}
        {!inBulkMode && (onMenuEdit || onDuplicate || onDelete) && (
          <ThreeDotMenu
            onEdit={() => onMenuEdit ? onMenuEdit(task) : onEdit(task)}
            onDuplicate={() => onDuplicate?.(task)}
            onDelete={() => onDelete?.(task)}
          />
        )}
      </div>

      {/* LINE 2: Badges (priority label + recurring) + due date (left) + Realm (right) */}
      <div className="flex items-center gap-1.5 ml-[26px]">
        {/* Priority badge */}
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: priorityColor + '18',
            color: priorityColor,
          }}
        >
          {PRIORITY_LABELS[task.priority] ?? task.priority}
        </span>

        {/* Recurring letter badge */}
        {recurringLetter && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#3B82F6]/10 text-[#3B82F6]">
            {recurringLetter}
          </span>
        )}

        {/* Due date + time */}
        {dueDateInfo && (
          <span className="text-[11px] leading-none font-normal" style={{ color: dueDateInfo.color }}>
            {dueDateInfo.label}
          </span>
        )}

        {/* Spacer + Realm on right */}
        <span className="flex-1" />
        <span className="text-[11px] leading-none font-normal text-[#AEAEB2]">
          {task.realm || 'Default'}
        </span>
      </div>

      {/* LINE 3: Target name (only if targetId set and project found) */}
      {targetTitle && (
        <div className="ml-[26px]">
          <span className="text-[11px] leading-none font-normal text-[#AEAEB2]">{targetDisplay}</span>
        </div>
      )}
    </div>
  );
}
