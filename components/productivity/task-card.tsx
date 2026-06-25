'use client'

import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreVertical, Check, Pencil, Trash2, Calendar, Copy } from 'lucide-react'
import type { Task } from '@/lib/types/database'
import { formatRelativeDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { TaskForm } from './task-form'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { toast } from 'sonner'

const PRIORITY_COLORS: Record<Task['priority'], string> = {
  low:    'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  high:   'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
}

const PRIORITY_DOT: Record<Task['priority'], string> = {
  low:    'bg-slate-400',
  medium: 'bg-blue-500',
  high:   'bg-orange-500',
  urgent: 'bg-red-500',
}

interface TaskCardProps {
  task: Task
  onComplete: (id: string) => void
  onUpdate: (id: string, data: Partial<Task>) => Promise<void>
  onDelete: (id: string) => void
  onDuplicate?: (id: string) => void
}

export function TaskCard({ task, onComplete, onUpdate, onDelete, onDuplicate }: TaskCardProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const isOverdue =
    task.due_date && task.due_date < new Date().toISOString().split('T')[0] && task.status !== 'done'

  return (
    <>
      <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/30 transition-colors group">
        {/* Complete button */}
        <button
          type="button"
          onClick={() => onComplete(task.id)}
          className={cn(
            'mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
            'border-muted-foreground/40 hover:border-primary hover:bg-primary/10'
          )}
          aria-label="Complete task"
        >
          <Check className="w-3 h-3 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-snug">{task.title}</p>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={cn('inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium', PRIORITY_COLORS[task.priority])}>
              <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_DOT[task.priority])} />
              {task.priority}
            </span>
            {task.due_date && (
              <span className={cn('flex items-center gap-1 text-xs', isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground')}>
                <Calendar className="w-3 h-3" />
                {formatRelativeDate(task.due_date)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center rounded-md hover:bg-accent">
            <MoreVertical className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <Pencil className="w-4 h-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onComplete(task.id)}>
              <Check className="w-4 h-4 mr-2" /> Mark done
            </DropdownMenuItem>
            {onDuplicate && (
              <DropdownMenuItem
                onClick={() => {
                  onDuplicate(task.id)
                  toast.success('Task duplicated')
                }}
              >
                <Copy className="w-4 h-4 mr-2" /> Duplicate
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setConfirmDelete(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <TaskForm
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={task}
        title="Edit Task"
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
