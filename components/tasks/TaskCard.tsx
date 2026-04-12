'use client';

import { useState, useRef, useEffect } from 'react';
import {
  CheckCircle2, Circle, MoreVertical, Pencil, Copy, Trash2, Sun,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn, formatTime, todayISO } from '@/lib/utils';
import { PRIORITY_COLORS, PRIORITY_LABELS, REALM_CONFIG } from '@/lib/constants';
import type { Task, Project, Recurrence } from '@/lib/types';

const RECURRENCE_LETTER: Record<Recurrence, string> = {
  None: '', Daily: 'D', Weekly: 'W', Monthly: 'M', Yearly: 'Y',
};

export function TaskCard({
  task,
  projects,
  onComplete,
  onEdit,
  onDelete,
  onDuplicate,
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
  const today = todayISO();
  const isOverdue = !task.isCompleted && task.dueDate && task.dueDate < today;
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMoved = useRef(false);

  const targetProject = projects.find((p) => p.id === (task.targetId ?? task.projectId));
  const recurringLetter = task.recurring ? RECURRENCE_LETTER[task.recurring] : '';
  const priorityColor = PRIORITY_COLORS[task.priority] ?? '#6C6C70';
  const priorityLabel = PRIORITY_LABELS[task.priority] ?? task.priority;

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

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
        'relative flex items-start gap-0 border-b border-[#E5E5EA] last:border-0',
        'active:bg-[#F5F5F5] transition-colors select-none',
        selected && 'bg-[#FF6B35]/6'
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleCardClick}
    >
      {/* Priority left border */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-sm"
        style={{ backgroundColor: priorityColor }}
      />

      {/* Bulk selection indicator or completion toggle */}
      <div className="pl-3 pt-3.5 flex-shrink-0">
        {inBulkMode ? (
          <div
            className={cn(
              'w-5 h-5 rounded-full border-2 flex items-center justify-center',
              selected ? 'bg-[#FF6B35] border-[#FF6B35]' : 'border-[#AEAEB2]'
            )}
          >
            {selected && <div className="w-2 h-2 rounded-full bg-white" />}
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onComplete(task); }}
            className="w-6 h-6 flex items-center justify-center"
          >
            {task.isCompleted
              ? <CheckCircle2 size={22} className="text-[#1ABC9C]" />
              : <Circle size={22} style={{ color: priorityColor }} />
            }
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-3 pl-2 pr-2">
        <p className={cn(
          'text-sm text-[#1C1C1E] leading-snug',
          task.isCompleted && 'line-through text-[#AEAEB2]'
        )}>
          {task.title}
        </p>

        {/* Badges row */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <Badge
            label={`${task.priority} · ${priorityLabel}`}
            color={priorityColor}
          />
          {recurringLetter && (
            <span
              className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: priorityColor }}
              title={`Recurring: ${task.recurring}`}
            >
              {recurringLetter}
            </span>
          )}
          {task.isMyDay && (
            <Sun size={12} className="text-[#FF6B35]" />
          )}
        </div>

        {/* Due date + time / overdue */}
        {task.dueDate && (
          <p className={cn(
            'text-xs mt-1',
            isOverdue ? 'text-[#FF4F6D]' : 'text-[#6C6C70]'
          )}>
            {isOverdue ? '⚠ Overdue · ' : ''}{task.dueDate === today ? 'Today' : task.dueDate}
            {task.dueTime && ` · ${formatTime(task.dueTime)}`}
          </p>
        )}
      </div>

      {/* Right side: target/realm + menu */}
      <div className="flex flex-col items-end justify-between py-3 pr-2 gap-2 flex-shrink-0">
        <div ref={menuRef} className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            className="w-7 h-7 flex items-center justify-center text-[#AEAEB2] hover:text-[#6C6C70] rounded-full hover:bg-[#F2F2F7]"
          >
            <MoreVertical size={15} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-50 bg-white border border-[#E5E5EA] rounded-card shadow-card min-w-[160px]">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onEdit(task); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#1C1C1E] hover:bg-[#F5F5F5]"
              >
                <Pencil size={14} /> Edit Action
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDuplicate(task); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#1C1C1E] hover:bg-[#F5F5F5]"
              >
                <Copy size={14} /> Duplicate
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(task); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[#FF4F6D] hover:bg-[#FFF1F2]"
              >
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end gap-0.5">
          {targetProject && (
            <span className="text-[10px] text-[#6C6C70] max-w-[80px] text-right truncate leading-tight">
              {targetProject.title}
            </span>
          )}
          <span
            className="text-[10px] max-w-[80px] text-right truncate leading-tight font-medium"
            style={{ color: REALM_CONFIG[task.realm]?.color ?? '#6C6C70' }}
          >
            {task.realm}
          </span>
        </div>
      </div>
    </div>
  );
}
