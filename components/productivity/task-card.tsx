'use client'

import { Check, Calendar, Clock } from 'lucide-react'
import type { Task } from '@/lib/types/database'
import { formatRelativeDate, display12h, isPastDeadline } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PRIORITY_CONFIG } from './task-constants'

interface TaskCardProps {
  task: Task
  onComplete: (id: string) => void
  onOpenDetail: (task: Task) => void
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

/**
 * Minimal, unified task card used everywhere (tasks page, dashboard, focus, calendar).
 * Shows only: a priority-colored completion checkbox, the title, and a green→red
 * due date/time. Every other action is reached by tapping the card to open the
 * shared task popup.
 */
export function TaskCard({
  task,
  onComplete,
  onOpenDetail,
  bulkMode = false,
  selected = false,
  onToggleSelect,
  view = 'list',
}: TaskCardProps) {
  const isCompleted = task.status === 'done'
  const priorityColor = PRIORITY_CONFIG[task.priority].color
  const overdue = !isCompleted && task.due_date ? isPastDeadline(task.due_date, task.due_time) : false

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-2.5 rounded-lg border transition-colors group',
        view === 'grid' ? 'flex-col min-h-[80px]' : '',
        isCompleted
          ? 'border-border/50 bg-muted/30 opacity-60'
          : selected
            ? 'border-primary/60 bg-primary/5'
            : 'border-border bg-card hover:bg-accent/30',
        isCompleted ? 'border-l-[3px] border-l-mod-tasks/30' : 'border-l-[3px] border-l-mod-tasks'
      )}
    >
      {/* Bulk checkbox / Complete button */}
      {bulkMode ? (
        <button
          type="button"
          onClick={() => onToggleSelect?.(task.id)}
          className={cn(
            'mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
            selected
              ? 'bg-primary border-primary'
              : 'border-muted-foreground/40 hover:border-primary'
          )}
          aria-label={selected ? 'Deselect task' : 'Select task'}
        >
          {selected && <Check className="w-3 h-3 text-primary-foreground" />}
        </button>
      ) : (
        <div className="relative mt-0.5 shrink-0 w-5 h-5">
          <button
            type="button"
            onClick={() => onComplete(task.id)}
            className={cn(
              'absolute inset-0 rounded-full border-2 flex items-center justify-center transition-colors',
              'before:absolute before:inset-[-10px] before:content-[""]'
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

        {/* Due date / time — green until the deadline, red after */}
        {task.due_date && (
          <span
            className={cn(
              'flex items-center gap-1 text-xs mt-1',
              isCompleted && 'text-muted-foreground'
            )}
            style={
              isCompleted
                ? undefined
                : { color: overdue ? 'var(--color-danger)' : 'var(--color-success)' }
            }
          >
            <Calendar className="w-3 h-3" />
            {formatRelativeDate(task.due_date)}
            {task.due_time && (
              <span className="flex items-center gap-0.5">
                <Clock className="w-3 h-3" />
                {display12h(task.due_time)}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  )
}
