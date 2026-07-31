'use client'

import { memo } from 'react'
import { Check, Calendar, Clock } from 'lucide-react'
import type { Task } from '@/lib/types/database'
import { formatRelativeDate, display12h, isPastDeadline, truncateLabel } from '@/lib/format'
import { AREA_META, areaTint } from '@/lib/area-colors'
import { cn } from '@/lib/utils'
import { PRIORITY_CONFIG } from './task-constants'

interface TaskCardProps {
  task: Task
  onComplete: (id: string) => void
  onOpenDetail: (task: Task) => void
  /** Name of the task's project, resolved by the parent. Shown right-aligned on the meta row. */
  projectName?: string | null
  // Retained for caller compatibility; secondary actions now live in the task popup.
  onUpdate?: (id: string, data: Partial<Task>) => Promise<void>
  onDelete?: (id: string) => void
  onDuplicate?: (id: string) => void
  onStar?: (id: string) => void
  showMenu?: boolean
  // Bulk selection
  bulkMode?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
  // View variant
  view?: 'list' | 'grid'
}

export const TaskCard = memo(function TaskCard({
  task,
  onComplete,
  onOpenDetail,
  projectName,
  bulkMode = false,
  selected = false,
  onToggleSelect,
  view = 'list',
}: TaskCardProps) {
  const isCompleted = task.status === 'done'
  const priorityColor = PRIORITY_CONFIG[task.priority].color
  const overdue = !isCompleted && task.due_date ? isPastDeadline(task.due_date, task.due_time) : false
  const area = AREA_META[task.area] ?? AREA_META.default
  // Completed and bulk-selected states own the surface, so the area tint stands down.
  const tint = isCompleted || selected ? undefined : areaTint(task.area)

  return (
    <div
      className={cn(
        'card-hover flex items-start gap-3 p-2.5 rounded-lg border border-l-[3px] shadow-card group',
        view === 'grid' ? 'flex-col min-h-[80px]' : '',
        isCompleted
          ? 'border-border/50 bg-muted/30 opacity-60'
          : selected
            ? 'border-primary/60 bg-primary/5'
            : 'border-border bg-card'
      )}
      // Inline so the area token also wins over the orange hover border.
      style={{ backgroundColor: tint, borderLeftColor: area.color }}
    >
      {/* Bulk checkbox / Complete button */}
      {bulkMode ? (
        <button
          type="button"
          onClick={() => onToggleSelect?.(task.id)}
          className={cn(
            'relative mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
            // Expands the hit area to the 44x44 minimum without changing layout.
            'before:absolute before:inset-[-12px] before:content-[""]',
            selected
              ? 'bg-primary border-primary'
              : 'border-muted-foreground/40 hover:border-primary'
          )}
          aria-label={selected ? 'Deselect task' : 'Select task'}
        >
          {selected && <Check className="w-3 h-3 text-primary-foreground" aria-hidden="true" />}
        </button>
      ) : (
        <div className="relative mt-0.5 shrink-0 w-5 h-5">
          <button
            type="button"
            onClick={() => onComplete(task.id)}
            className={cn(
              'absolute inset-0 rounded-full border-2 flex items-center justify-center transition-colors',
              // Expands the hit area to the 44x44 minimum without changing layout.
              'before:absolute before:inset-[-12px] before:content-[""]'
            )}
            style={
              isCompleted
                ? { backgroundColor: priorityColor, borderColor: priorityColor }
                : { borderColor: priorityColor }
            }
            aria-label={isCompleted ? 'Mark task incomplete' : 'Complete task'}
          >
            <Check
              className={cn(
                'w-3 h-3 transition-opacity',
                isCompleted ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              )}
              style={{ color: isCompleted ? '#ffffff' : priorityColor }}
              aria-hidden="true"
            />
          </button>
        </div>
      )}

      {/* Content — click opens the shared task popup */}
      <div
        role="button"
        tabIndex={0}
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => onOpenDetail(task)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onOpenDetail(task)
          }
        }}
      >
        <p className={cn(
          'text-sm font-medium leading-snug',
          isCompleted && 'line-through text-muted-foreground'
        )}>
          {task.title}
        </p>

        {/* Subtask progress */}
        {task.subtasks && task.subtasks.length > 0 && (
          <span className="flex items-center gap-1 text-xs mt-0.5 text-muted-foreground">
            <Check className="w-3 h-3" aria-hidden="true" />
            {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
          </span>
        )}

        {/* Meta row — due date/time left, project name right, both 12px */}
        <div className="flex items-center justify-between gap-2 mt-1">
          {task.due_date ? (
            <span
              className={cn(
                'flex items-center gap-1 text-xs min-w-0',
                isCompleted && 'text-muted-foreground'
              )}
              style={
                isCompleted
                  ? undefined
                  : { color: overdue ? 'var(--color-danger)' : 'var(--color-success)' }
              }
            >
              <Calendar className="w-3 h-3 shrink-0" aria-hidden="true" />
              {formatRelativeDate(task.due_date)}
              {task.due_time && (
                <span className="flex items-center gap-0.5">
                  <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
                  {display12h(task.due_time)}
                </span>
              )}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs min-w-0 text-muted-foreground">
              <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
              {formatRelativeDate(task.created_at.slice(0, 10))}
            </span>
          )}

          {projectName ? (
            <span className="text-xs text-muted-foreground shrink-0" title={projectName}>
              {truncateLabel(projectName)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
})
