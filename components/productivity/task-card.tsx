'use client'

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu'
import {
  MoreVertical, Check, Pencil, Trash2, Calendar, Copy,
  Star, Repeat2, Bell, Paperclip, Clock, Tag, ChevronDown,
} from 'lucide-react'
import type { Task } from '@/lib/types/database'
import { formatRelativeDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { TaskForm } from './task-form'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'

// ─── P1/P2/P3/P4 priority mapping ────────────────────────────────────────────

const PRIORITY_LABEL: Record<Task['priority'], string> = {
  urgent: 'P1', high: 'P2', medium: 'P3', low: 'P4',
}

const PRIORITY_PILL: Record<Task['priority'], string> = {
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
  high:   'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
  low:    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
}

const PRIORITY_DOT: Record<Task['priority'], string> = {
  urgent: 'bg-red-500',
  high:   'bg-orange-500',
  medium: 'bg-blue-500',
  low:    'bg-slate-400',
}

// ─── Repeat label helper ──────────────────────────────────────────────────────

function repeatLabel(rule: string | null): string {
  if (!rule) return ''
  if (rule.includes('WEEKLY;BYDAY=MO')) return 'Weekdays'
  if (rule.includes('FREQ=DAILY'))   return 'Daily'
  if (rule.includes('FREQ=WEEKLY'))  return 'Weekly'
  if (rule.includes('FREQ=MONTHLY')) return 'Monthly'
  if (rule.includes('FREQ=YEARLY'))  return 'Yearly'
  return 'Recurring'
}

interface TaskCardProps {
  task: Task
  onComplete: (id: string) => void
  onUpdate: (id: string, data: Partial<Task>) => Promise<void>
  onDelete: (id: string) => void
  onDuplicate?: (id: string) => void
  onStar?: (id: string) => void
  // Bulk selection
  bulkMode?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
  // View variant
  view?: 'list' | 'grid'
  // Projects for edit form
  projects?: Array<{ id: string; name: string; color: string }>
}

export function TaskCard({
  task,
  onComplete,
  onUpdate,
  onDelete,
  onDuplicate,
  onStar,
  bulkMode = false,
  selected = false,
  onToggleSelect,
  view = 'list',
  projects = [],
}: TaskCardProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [subtasksExpanded, setSubtasksExpanded] = useState(false)

  const isOverdue =
    task.due_date &&
    task.due_date < new Date().toISOString().split('T')[0] &&
    task.status !== 'done'

  const doneSubtasks = task.subtasks?.filter((s) => s.done).length ?? 0
  const totalSubtasks = task.subtasks?.length ?? 0
  const hasSubtasks = totalSubtasks > 0

  const isCompleted = task.status === 'done'

  return (
    <>
      <div
        className={cn(
          'flex items-start gap-3 p-3 rounded-lg border transition-colors group',
          view === 'grid' ? 'flex-col' : '',
          isCompleted
            ? 'border-border/50 bg-muted/30 opacity-60'
            : selected
              ? 'border-primary/60 bg-primary/5'
              : 'border-border bg-card hover:bg-accent/30',
          task.is_starred && !isCompleted && 'border-amber-300/60 dark:border-amber-700/40'
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
          >
            {selected && <Check className="w-3 h-3 text-primary-foreground" />}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onComplete(task.id)}
            className={cn(
              'mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
              isCompleted
                ? 'bg-muted border-muted-foreground/30'
                : 'border-muted-foreground/40 hover:border-primary hover:bg-primary/10'
            )}
            aria-label="Complete task"
          >
            <Check className={cn(
              'w-3 h-3 transition-opacity text-primary',
              isCompleted ? 'opacity-50' : 'opacity-0 group-hover:opacity-100'
            )} />
          </button>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className={cn(
            'text-sm font-medium leading-snug',
            isCompleted && 'line-through text-muted-foreground'
          )}>
            {task.title}
          </p>

          {task.description && view !== 'grid' && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
          )}

          {/* Pills row */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {/* Priority P1–P4 */}
            <span className={cn(
              'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-bold',
              PRIORITY_PILL[task.priority]
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_DOT[task.priority])} />
              {PRIORITY_LABEL[task.priority]}
            </span>

            {/* Due date */}
            {task.due_date && (
              <span className={cn(
                'flex items-center gap-1 text-xs',
                isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'
              )}>
                <Calendar className="w-3 h-3" />
                {formatRelativeDate(task.due_date)}
                {task.due_time && (
                  <span className="flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    {task.due_time.slice(0, 5)}
                  </span>
                )}
              </span>
            )}

            {/* Repeat */}
            {task.is_recurring && task.recurrence_rule && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Repeat2 className="w-3 h-3" />
                {repeatLabel(task.recurrence_rule)}
              </span>
            )}

            {/* Reminder */}
            {task.reminder_at && (
              <span className="text-xs text-muted-foreground" title={new Date(task.reminder_at).toLocaleString()}>
                <Bell className="w-3 h-3" />
              </span>
            )}

            {/* Subtasks progress */}
            {hasSubtasks && (
              <button
                type="button"
                onClick={() => setSubtasksExpanded((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Check className="w-3 h-3" />
                {doneSubtasks}/{totalSubtasks}
                <ChevronDown className={cn('w-3 h-3 transition-transform', subtasksExpanded && 'rotate-180')} />
              </button>
            )}

            {/* Attachments */}
            {(task.attachments?.length ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Paperclip className="w-3 h-3" />
                {task.attachments.length}
              </span>
            )}

            {/* Tags */}
            {(task.tags?.length ?? 0) > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Tag className="w-3 h-3" />
                {task.tags.slice(0, 2).map((t) => (
                  <span key={t} className="bg-secondary px-1 rounded text-secondary-foreground">#{t}</span>
                ))}
                {task.tags.length > 2 && <span>+{task.tags.length - 2}</span>}
              </span>
            )}
          </div>

          {/* Subtask list (expanded) */}
          {hasSubtasks && subtasksExpanded && (
            <div className="mt-2 space-y-1 pl-1 border-l-2 border-muted">
              {task.subtasks.map((sub) => (
                <div key={sub.id} className="flex items-center gap-1.5 text-xs">
                  <span className={cn(
                    'w-3 h-3 rounded-full border flex items-center justify-center shrink-0',
                    sub.done ? 'bg-primary border-primary' : 'border-muted-foreground/40'
                  )}>
                    {sub.done && <Check className="w-2 h-2 text-primary-foreground" />}
                  </span>
                  <span className={cn(sub.done && 'line-through text-muted-foreground')}>{sub.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right side actions */}
        <div className={cn('flex items-center gap-1 shrink-0', view === 'grid' && 'self-end w-full justify-between')}>
          {/* Star button */}
          {onStar && (
            <button
              type="button"
              onClick={() => onStar(task.id)}
              className={cn(
                'w-7 h-7 inline-flex items-center justify-center rounded-md transition-colors',
                task.is_starred
                  ? 'text-amber-500 hover:text-amber-600'
                  : 'text-muted-foreground/30 hover:text-amber-500 opacity-0 group-hover:opacity-100'
              )}
              aria-label={task.is_starred ? 'Unstar task' : 'Star task'}
            >
              <Star className={cn('w-4 h-4', task.is_starred && 'fill-amber-500')} />
            </button>
          )}

          {/* More menu */}
          {!bulkMode && (
            <DropdownMenu>
              <DropdownMenuTrigger className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center rounded-md hover:bg-accent">
                <MoreVertical className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="w-4 h-4 mr-2" /> Edit
                </DropdownMenuItem>
                {!isCompleted && (
                  <DropdownMenuItem onClick={() => onComplete(task.id)}>
                    <Check className="w-4 h-4 mr-2" /> Mark done
                  </DropdownMenuItem>
                )}
                {onDuplicate && (
                  <DropdownMenuItem onClick={() => { onDuplicate(task.id); toast.success('Task duplicated') }}>
                    <Copy className="w-4 h-4 mr-2" /> Duplicate
                  </DropdownMenuItem>
                )}
                {onStar && (
                  <DropdownMenuItem onClick={() => onStar(task.id)}>
                    <Star className="w-4 h-4 mr-2" />
                    {task.is_starred ? 'Unstar' : 'Star / Pin'}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <span className="text-xs font-bold mr-2">{PRIORITY_LABEL[task.priority]}</span>
                    Set Priority
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {(['urgent', 'high', 'medium', 'low'] as Task['priority'][]).map((p) => (
                      <DropdownMenuItem
                        key={p}
                        onClick={() => onUpdate(task.id, { priority: p })}
                        className={task.priority === p ? 'font-semibold' : ''}
                      >
                        <span className={cn('text-xs font-bold mr-2', PRIORITY_PILL[p], 'px-1 rounded')}>
                          {PRIORITY_LABEL[p]}
                        </span>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setConfirmDelete(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <TaskForm
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={task}
        title="Edit Task"
        projects={projects}
        onSubmit={async (data) => {
          await onUpdate(task.id, data)
          toast.success('Task updated')
          setEditOpen(false)
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete task?"
        description={`"${task.title}" will be permanently deleted.`}
        onConfirm={() => {
          onDelete(task.id)
          toast.success('Task deleted')
        }}
      />
    </>
  )
}
