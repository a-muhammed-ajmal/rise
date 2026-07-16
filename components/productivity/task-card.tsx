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
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'
import { PRIORITY_PILL, PRIORITY_DOT, repeatLabel, getLabelColor } from './task-constants'

interface TaskCardProps {
  task: Task
  onComplete: (id: string) => void
  onUpdate: (id: string, data: Partial<Task>) => Promise<void>
  onDelete: (id: string) => void
  onDuplicate?: (id: string) => void
  onStar?: (id: string) => void
  onOpenDetail: (task: Task) => void
  // Bulk selection
  bulkMode?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
  // View variant
  view?: 'list' | 'grid'
  // Hide the ⋮ actions menu (e.g. dashboard preview where the popup owns all actions)
  showMenu?: boolean
}

export function TaskCard({
  task,
  onComplete,
  onUpdate,
  onDelete,
  onDuplicate,
  onStar,
  onOpenDetail,
  bulkMode = false,
  selected = false,
  onToggleSelect,
  view = 'list',
  showMenu = true,
}: TaskCardProps) {
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
          'flex items-start gap-3 p-2.5 rounded-lg border transition-colors group',
          view === 'grid' ? 'flex-col min-h-[120px]' : '',
          isCompleted
            ? 'border-border/50 bg-muted/30 opacity-60'
            : selected
              ? 'border-primary/60 bg-primary/5'
              : 'border-border bg-card hover:bg-accent/30',
          task.is_starred && !isCompleted && 'border-[var(--color-warning)]/40',
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
                'before:absolute before:inset-[-10px] before:content-[""]',
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
          </div>
        )}

        {/* Content — click opens the shared task popup */}
        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={() => onOpenDetail(task)}
        >
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
              'inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-semibold',
              PRIORITY_PILL[task.priority]
            )}>
              <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_DOT[task.priority])} />
              {task.priority}
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
            {task.recurrence && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Repeat2 className="w-3 h-3" />
                {repeatLabel(task.recurrence)}
              </span>
            )}

            {/* Reminder */}
            {task.reminder && (
              <span className="text-xs text-muted-foreground" title={new Date(task.reminder).toLocaleString()}>
                <Bell className="w-3 h-3" />
              </span>
            )}

            {/* Subtasks progress */}
            {hasSubtasks && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setSubtasksExpanded((v) => !v) }}
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

            {/* Labels */}
            {(task.labels?.length ?? 0) > 0 && (
              <span className="flex items-center gap-1 flex-wrap">
                <Tag className="w-3 h-3 text-muted-foreground shrink-0" aria-hidden="true" />
                {task.labels.slice(0, 2).map((t) => (
                  <span
                    key={t}
                    className={cn(
                      'text-[11px] font-semibold px-1.5 py-0.5 rounded-full leading-none',
                      getLabelColor(t)
                    )}
                  >
                    #{t}
                  </span>
                ))}
                {task.labels.length > 2 && (
                  <span className="text-[11px] text-muted-foreground">+{task.labels.length - 2}</span>
                )}
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
                  ? 'text-[var(--color-warning)] hover:text-[var(--color-warning)]/80'
                  : 'text-muted-foreground/30 hover:text-[var(--color-warning)] opacity-0 group-hover:opacity-100'
              )}
              aria-label={task.is_starred ? 'Unstar task' : 'Star task'}
            >
              <Star className={cn('w-4 h-4', task.is_starred && 'fill-[var(--color-warning)]')} />
            </button>
          )}

          {/* More menu */}
          {!bulkMode && showMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center rounded-md hover:bg-accent">
                <MoreVertical className="w-4 h-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onOpenDetail(task)}>
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
                    <span className="text-xs font-semibold mr-2">{task.priority}</span>
                    Set Priority
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {(['P1', 'P2', 'P3', 'P4'] as Task['priority'][]).map((p) => (
                      <DropdownMenuItem
                        key={p}
                        onClick={() => onUpdate(task.id, { priority: p })}
                        className={task.priority === p ? 'font-semibold' : ''}
                      >
                        <span className={cn('text-xs font-semibold mr-2', PRIORITY_PILL[p], 'px-1 rounded')}>
                          {p}
                        </span>
                        {p === 'P1' ? 'Urgent' : p === 'P2' ? 'High' : p === 'P3' ? 'Medium' : 'Low'}
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
