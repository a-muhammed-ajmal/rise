'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Check, Trash2, Copy, MoreVertical, Link as LinkIcon,
  CalendarDays, Clock, Bell, Repeat2, Plus, X, Star,
  MessageSquare, ChevronDown,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DateTimePicker } from './DateTimePicker'
import {
  PRIORITY_MAP, PRIORITY_PILL, repeatLabel,
} from './task-constants'
import { formatRelativeDate, formatDateTime, display12h } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useTasks } from '@/lib/hooks/use-tasks'
import { useProjects } from '@/lib/hooks/use-projects'
import type { Task, Subtask } from '@/lib/types/database'

interface TaskDetailPopupProps {
  task: Task
  onClose: () => void
}

export function TaskDetailPopup({ task, onClose }: TaskDetailPopupProps) {
  const { tasks, updateTask, completeTask, reopenTask, deleteTask, duplicateTask, toggleFocus, addComment } = useTasks('all')
  const { projects } = useProjects()

  // Live task — falls back to prop if not yet in hook list (e.g. just created)
  const liveTask = tasks.find((t) => t.id === task.id) ?? task

  // ── Editable local state ────────────────────────────────────────────────────
  const [title, setTitle]           = useState(liveTask.title)
  const [description, setDescription] = useState(liveTask.description ?? '')
  const [priority, setPriority]     = useState<Task['priority']>(liveTask.priority)
  const [projectId, setProjectId]   = useState(liveTask.project_id ?? '')
  const [dueDate, setDueDate]       = useState(liveTask.due_date ?? '')
  const [dueTime, setDueTime]       = useState(liveTask.due_time ?? '')
  const [labels, setLabels]         = useState<string[]>(liveTask.labels)
  const [labelInput, setLabelInput] = useState('')
  const [subtasks, setSubtasks]     = useState<Subtask[]>(liveTask.subtasks)
  const [newSubtask, setNewSubtask] = useState('')
  const [comment, setComment]       = useState('')

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [showDatePicker, setShowDatePicker]         = useState(false)
  const [showCompletedSubtasks, setShowCompletedSubtasks] = useState(false)
  const [confirmDelete, setConfirmDelete]           = useState(false)
  const [completing, setCompleting]                 = useState(false)

  const titleRef   = useRef<HTMLTextAreaElement>(null)
  const subtaskRef = useRef<HTMLInputElement>(null)

  // Auto-grow title textarea
  useEffect(() => {
    const el = titleRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [title])

  // ── Save handlers ─────────────────────────────────────────────────────────────

  function handleTitleBlur() {
    const t = title.trim()
    if (t && t !== liveTask.title) updateTask(task.id, { title: t })
    else if (!t) setTitle(liveTask.title)
  }

  function handleDescriptionBlur() {
    const d = description.trim() || null
    if (d !== liveTask.description) updateTask(task.id, { description: d })
  }

  function handlePriorityChange(p: Task['priority'] | null) {
    if (!p) return
    setPriority(p)
    updateTask(task.id, { priority: p })
  }

  function handleProjectChange(v: string | null) {
    const id = (!v || v === 'none') ? null : v
    setProjectId(id ?? '')
    updateTask(task.id, { project_id: id })
  }

  function handleDateChange(v: { date?: string; time?: string }) {
    setDueDate(v.date ?? '')
    setDueTime(v.time ?? '')
    updateTask(task.id, { due_date: v.date ?? null, due_time: v.time ?? null })
  }

  // ── Labels ───────────────────────────────────────────────────────────────────

  function commitLabel() {
    const l = labelInput.trim().toLowerCase()
    if (l && !labels.includes(l)) {
      const updated = [...labels, l]
      setLabels(updated)
      updateTask(task.id, { labels: updated })
    }
    setLabelInput('')
  }

  function toggleLabel(label: string) {
    const updated = labels.includes(label)
      ? labels.filter((x) => x !== label)
      : [...labels, label]
    setLabels(updated)
    updateTask(task.id, { labels: updated })
  }

  function handleLabelKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitLabel() }
    else if (e.key === 'Backspace' && !labelInput) {
      const updated = labels.slice(0, -1)
      setLabels(updated)
      updateTask(task.id, { labels: updated })
    }
  }

  // ── Subtasks ─────────────────────────────────────────────────────────────────

  function handleAddSubtask() {
    const t = newSubtask.trim()
    if (!t) return
    const updated: Subtask[] = [...subtasks, { id: crypto.randomUUID(), title: t, done: false }]
    setSubtasks(updated)
    setNewSubtask('')
    updateTask(task.id, { subtasks: updated })
    setTimeout(() => subtaskRef.current?.focus(), 0)
  }

  function toggleSubtask(id: string) {
    const updated = subtasks.map((s) => s.id === id ? { ...s, done: !s.done } : s)
    setSubtasks(updated)
    updateTask(task.id, { subtasks: updated })
  }

  function removeSubtask(id: string) {
    const updated = subtasks.filter((s) => s.id !== id)
    setSubtasks(updated)
    updateTask(task.id, { subtasks: updated })
  }

  // ── Comments ─────────────────────────────────────────────────────────────────

  async function handleAddComment() {
    const t = comment.trim()
    if (!t) return
    await addComment(task.id, t)
    setComment('')
  }

  // ── Complete / Reopen / Delete ────────────────────────────────────────────────

  function handleComplete() {
    setCompleting(true)
    completeTask(task.id)
    setTimeout(onClose, 1500)
  }

  function handleReopen() {
    reopenTask(task.id)
    setCompleting(false)
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/productivity#task-${task.id}`)
    toast.success('Link copied')
  }

  const doneSubtasks  = subtasks.filter((s) => s.done).length
  const activeSubtasks = subtasks.filter((s) => !s.done)
  const doneSubtaskList = subtasks.filter((s) => s.done)

  const isCompleted = liveTask.is_completed || completing

  return (
    <>
      <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden p-0">

          {/* Header */}
          <DialogHeader className="shrink-0 px-4 pt-4 pb-3 border-b">
            <div className="flex items-start gap-3 pr-6">

              {/* Circle complete / reopen */}
              <button
                type="button"
                onClick={isCompleted ? handleReopen : handleComplete}
                className={cn(
                  'mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                  isCompleted
                    ? 'bg-[var(--color-success)] border-[var(--color-success)]'
                    : 'border-muted-foreground/40 hover:border-[var(--color-success)] hover:bg-[var(--color-success)]/10'
                )}
                aria-label={isCompleted ? 'Reopen task' : 'Mark complete'}
              >
                {isCompleted && <Check className="w-3.5 h-3.5 text-white" />}
              </button>

              {/* Title textarea */}
              <Textarea
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                className="flex-1 resize-none text-base font-medium border-0 p-0 shadow-none focus-visible:ring-0 min-h-[1.5rem] overflow-hidden"
                rows={1}
              />

              {/* Focus toggle */}
              <button
                type="button"
                onClick={() => toggleFocus(task.id)}
                className={cn(
                  'shrink-0 h-7 w-7 flex items-center justify-center rounded-md transition-colors',
                  liveTask.is_focus
                    ? 'text-[var(--color-warning)]'
                    : 'text-muted-foreground/30 hover:text-[var(--color-warning)]'
                )}
                aria-label={liveTask.is_focus ? 'Remove from focus' : 'Add to focus'}
              >
                <Star className={cn('w-4 h-4', liveTask.is_focus && 'fill-[var(--color-warning)]')} />
              </button>

              {/* More menu */}
              <DropdownMenu>
                <DropdownMenuTrigger className="shrink-0 h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => {
                    duplicateTask(task.id)
                    toast.success('Task duplicated')
                  }}>
                    <Copy className="w-4 h-4 mr-2" /> Duplicate Task
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyLink}>
                    <LinkIcon className="w-4 h-4 mr-2" /> Copy Link
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setConfirmDelete(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Delete Task
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </DialogHeader>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto space-y-4 px-4 py-3">

            {/* Description */}
            <div className="space-y-1">
              <Textarea
                placeholder="Add notes…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescriptionBlur}
                rows={3}
                maxLength={5000}
                className="resize-none text-sm"
              />
              {description.length > 4800 && (
                <p className="text-xs text-muted-foreground text-right">
                  {description.length}/5000
                </p>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Priority</Label>
              <Select value={priority} onValueChange={(v) => handlePriorityChange(v as Task['priority'])}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_MAP.map((p) => (
                    <SelectItem key={p.value} value={p.value} className="text-xs">
                      <span className={cn('text-xs font-semibold px-1 rounded mr-1', PRIORITY_PILL[p.value])}>
                        {p.label}
                      </span>
                      {p.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project */}
            {projects.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Project</Label>
                <Select value={projectId || 'none'} onValueChange={handleProjectChange}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="No project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-xs">Inbox</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        <span className="w-2 h-2 rounded-full inline-block mr-1.5" style={{ backgroundColor: p.color }} />
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Due Date */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Due Date</Label>
              <button
                type="button"
                onClick={() => setShowDatePicker((v) => !v)}
                className={cn(
                  'w-full flex items-center gap-2 h-8 px-2.5 rounded-lg border text-xs text-left transition-colors',
                  dueDate ? 'border-primary/40 text-foreground' : 'border-border text-muted-foreground',
                  'hover:border-ring'
                )}
              >
                <CalendarDays className="w-3.5 h-3.5 shrink-0" />
                {dueDate ? formatRelativeDate(dueDate) : 'No due date'}
                {dueTime && (
                  <>
                    <Clock className="w-3 h-3 ml-1 text-muted-foreground" />
                    <span className="text-muted-foreground">{display12h(dueTime)}</span>
                  </>
                )}
              </button>
            </div>

            {/* Read-only: Repeat */}
            {liveTask.recurrence && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-1 border-t">
                <Repeat2 className="w-3.5 h-3.5 shrink-0" />
                <span>Repeats {repeatLabel(liveTask.recurrence)}</span>
              </div>
            )}

            {/* Read-only: Reminder */}
            {liveTask.reminder && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                <Bell className="w-3.5 h-3.5 shrink-0" />
                <span>Reminder: {formatDateTime(liveTask.reminder)}</span>
              </div>
            )}

            {/* Labels */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Labels</Label>
              <div className="flex flex-wrap gap-1.5 p-2 border rounded-lg min-h-[2.25rem] focus-within:ring-1 focus-within:ring-ring">
                {labels.map((label) => (
                  <Badge
                    key={label}
                    variant="secondary"
                    className="gap-1 text-xs cursor-pointer hover:bg-destructive/10"
                    onClick={() => toggleLabel(label)}
                  >
                    #{label}
                    <X className="w-2.5 h-2.5" />
                  </Badge>
                ))}
                <input
                  className="flex-1 min-w-[80px] bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                  placeholder={labels.length === 0 ? 'Add label…' : ''}
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyDown={handleLabelKeyDown}
                  onBlur={commitLabel}
                />
              </div>
              <p className="text-xs text-muted-foreground">Enter or comma to add · click label to remove</p>
            </div>

            {/* Subtasks */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Subtasks
                {subtasks.length > 0 && (
                  <span className="ml-1 text-muted-foreground/60">
                    {doneSubtasks}/{subtasks.length}
                  </span>
                )}
              </Label>

              <div className="flex gap-2">
                <Input
                  ref={subtaskRef}
                  placeholder="Add subtask…"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask() } }}
                  className="flex-1 h-8 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddSubtask}
                  aria-label="Add subtask"
                  className="h-8 w-8 flex items-center justify-center rounded-md border hover:bg-accent transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Active subtasks */}
              <div className="space-y-1">
                {activeSubtasks.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 group">
                    <button
                      type="button"
                      onClick={() => toggleSubtask(sub.id)}
                      aria-label={`Mark subtask done: ${sub.title}`}
                      className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors border-muted-foreground/40 hover:border-primary"
                    />
                    <span className="flex-1 text-xs">{sub.title}</span>
                    <button
                      type="button"
                      onClick={() => removeSubtask(sub.id)}
                      aria-label={`Remove subtask: ${sub.title}`}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Completed subtasks toggle */}
              {doneSubtaskList.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowCompletedSubtasks((v) => !v)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showCompletedSubtasks && 'rotate-180')} />
                    {doneSubtaskList.length} completed
                  </button>
                  {showCompletedSubtasks && (
                    <div className="space-y-1">
                      {doneSubtaskList.map((sub) => (
                        <div key={sub.id} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 group">
                          <button
                            type="button"
                            onClick={() => toggleSubtask(sub.id)}
                            aria-label={`Reopen subtask: ${sub.title}`}
                            className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 bg-primary border-primary"
                          >
                            <Check className="w-2.5 h-2.5 text-primary-foreground" />
                          </button>
                          <span className="flex-1 text-xs line-through text-muted-foreground">{sub.title}</span>
                          <button
                            type="button"
                            onClick={() => removeSubtask(sub.id)}
                            aria-label={`Remove subtask: ${sub.title}`}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Comments */}
            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Comments
                {liveTask.comments.length > 0 && (
                  <span className="text-muted-foreground/60">{liveTask.comments.length}</span>
                )}
              </Label>

              {/* Existing comments */}
              {liveTask.comments.length > 0 && (
                <div className="space-y-2">
                  {liveTask.comments.map((c) => (
                    <div key={c.id} className="text-xs bg-muted/50 rounded-lg px-3 py-2">
                      <p className="text-foreground">{c.text}</p>
                      <p className="text-muted-foreground mt-0.5">{formatDateTime(c.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Add comment */}
              <div className="flex gap-2">
                <Input
                  placeholder="Write a comment…"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment() } }}
                  className="flex-1 h-8 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddComment}
                  disabled={!comment.trim()}
                  aria-label="Add comment"
                  className="h-8 w-8 flex items-center justify-center rounded-md border hover:bg-accent transition-colors disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Activity log */}
              {liveTask.activity.length > 0 && (
                <div className="space-y-1 pt-1 border-t">
                  {liveTask.activity.map((a) => (
                    <p key={a.id} className="text-xs text-muted-foreground">
                      {a.action}
                      {a.field && (
                        <span> · <span className="font-medium">{a.field}</span></span>
                      )}
                      <span className="ml-1">{formatDateTime(a.created_at)}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="shrink-0 px-4 py-3 border-t flex items-center justify-between">
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="h-8 px-3 text-xs rounded-md text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 inline mr-1" />
              Delete
            </button>

            <div className="flex items-center gap-2">
              {completing && (
                <span className="flex items-center gap-1.5 text-sm text-[var(--color-success)]">
                  <Check className="w-4 h-4" />
                  Marked as done
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                className="h-8 px-3 text-xs rounded-md hover:bg-accent transition-colors text-muted-foreground"
              >
                Close
              </button>
              <button
                type="button"
                onClick={isCompleted ? handleReopen : handleComplete}
                className={cn(
                  'h-8 px-3 text-xs rounded-md font-medium transition-colors',
                  isCompleted
                    ? 'bg-muted text-muted-foreground hover:bg-accent'
                    : 'bg-[var(--color-success)]/10 text-[var(--color-success)] hover:bg-[var(--color-success)]/20'
                )}
              >
                {isCompleted ? 'Reopen' : 'Mark Complete'}
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DateTimePicker overlay — fixed above the Dialog */}
      {showDatePicker && (
        <>
          <div className="fixed inset-0 z-[59]" onClick={() => setShowDatePicker(false)} />
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60]">
            <DateTimePicker
              value={{ date: dueDate || undefined, time: dueTime || undefined }}
              onChange={handleDateChange}
              onClose={() => setShowDatePicker(false)}
            />
          </div>
        </>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete task?"
        description={`"${liveTask.title}" will be permanently deleted.`}
        confirmLabel="Delete"
        onConfirm={() => {
          deleteTask(task.id)
          onClose()
        }}
      />
    </>
  )
}
