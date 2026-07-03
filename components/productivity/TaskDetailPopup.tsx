'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Check, Trash2, Copy, MoreVertical, Link as LinkIcon,
  CalendarDays, Clock, Bell, Repeat2, Plus, X,
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
  PRIORITY_MAP, PRIORITY_PILL, STATUS_CONFIG, repeatLabel,
} from './task-constants'
import { formatRelativeDate, formatDateTime, display12h } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Task, Subtask } from '@/lib/types/database'

interface TaskDetailPopupProps {
  task: Task
  onClose: () => void
  onUpdate: (id: string, data: Partial<Task>) => Promise<void>
  onComplete: (id: string) => void
  onDelete: (id: string) => void
  onDuplicate?: (id: string) => void
  projects: Array<{ id: string; name: string; color: string }>
}

export function TaskDetailPopup({
  task,
  onClose,
  onUpdate,
  onComplete,
  onDelete,
  onDuplicate,
  projects,
}: TaskDetailPopupProps) {
  const [title, setTitle]             = useState(task.title)
  const [description, setDescription] = useState(task.description ?? '')
  const [status, setStatus]           = useState<Task['status']>(task.status)
  const [priority, setPriority]       = useState<Task['priority']>(task.priority)
  const [projectId, setProjectId]     = useState(task.project_id ?? '')
  const [dueDate, setDueDate]         = useState(task.due_date ?? '')
  const [dueTime, setDueTime]         = useState(task.due_time ?? '')
  const [tags, setTags]               = useState<string[]>(task.tags)
  const [tagInput, setTagInput]       = useState('')
  const [subtasks, setSubtasks]       = useState<Subtask[]>(task.subtasks)
  const [subtaskInput, setSubtaskInput] = useState('')

  const [showDatePicker, setShowDatePicker] = useState(false)
  const [confirmDelete, setConfirmDelete]   = useState(false)
  const [completing, setCompleting]         = useState(false)

  const titleRef    = useRef<HTMLTextAreaElement>(null)
  const subtaskRef  = useRef<HTMLInputElement>(null)

  // Auto-grow title textarea
  useEffect(() => {
    const el = titleRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [title])

  // ── Save handlers ────────────────────────────────────────────────────────────

  function handleTitleBlur() {
    const t = title.trim()
    if (t && t !== task.title) {
      onUpdate(task.id, { title: t })
    } else if (!t) {
      setTitle(task.title)
    }
  }

  function handleDescriptionBlur() {
    const d = description.trim() || null
    if (d !== task.description) {
      onUpdate(task.id, { description: d })
    }
  }

  function handleStatusChange(s: Task['status'] | null) {
    if (!s) return
    setStatus(s)
    onUpdate(task.id, { status: s })
  }

  function handlePriorityChange(p: Task['priority'] | null) {
    if (!p) return
    setPriority(p)
    onUpdate(task.id, { priority: p })
  }

  function handleProjectChange(v: string | null) {
    const id = (!v || v === 'none') ? null : v
    setProjectId(id ?? '')
    onUpdate(task.id, { project_id: id })
  }

  function handleDateTimeChange(v: { date?: string; time?: string }) {
    setDueDate(v.date ?? '')
    setDueTime(v.time ?? '')
    onUpdate(task.id, { due_date: v.date ?? null, due_time: v.time ?? null })
  }

  // ── Subtasks ─────────────────────────────────────────────────────────────────

  function addSubtask() {
    const t = subtaskInput.trim()
    if (!t) return
    const updated: Subtask[] = [...subtasks, { id: crypto.randomUUID(), title: t, done: false }]
    setSubtasks(updated)
    setSubtaskInput('')
    onUpdate(task.id, { subtasks: updated })
    setTimeout(() => subtaskRef.current?.focus(), 0)
  }

  function toggleSubtask(id: string) {
    const updated = subtasks.map((s) => s.id === id ? { ...s, done: !s.done } : s)
    setSubtasks(updated)
    onUpdate(task.id, { subtasks: updated })
  }

  function removeSubtask(id: string) {
    const updated = subtasks.filter((s) => s.id !== id)
    setSubtasks(updated)
    onUpdate(task.id, { subtasks: updated })
  }

  // ── Tags ─────────────────────────────────────────────────────────────────────

  function commitTag() {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) {
      const updated = [...tags, t]
      setTags(updated)
      onUpdate(task.id, { tags: updated })
    }
    setTagInput('')
  }

  function removeTag(tag: string) {
    const updated = tags.filter((x) => x !== tag)
    setTags(updated)
    onUpdate(task.id, { tags: updated })
  }

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commitTag()
    } else if (e.key === 'Backspace' && !tagInput) {
      const updated = tags.slice(0, -1)
      setTags(updated)
      onUpdate(task.id, { tags: updated })
    }
  }

  // ── Complete / Delete ─────────────────────────────────────────────────────────

  function handleComplete() {
    setCompleting(true)
    onComplete(task.id)
    setTimeout(onClose, 1500)
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/productivity#task-${task.id}`)
    toast.success('Link copied')
  }

  const doneCount = subtasks.filter((s) => s.done).length

  return (
    <>
      <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden p-0">

          {/* Header */}
          <DialogHeader className="shrink-0 px-4 pt-4 pb-3 border-b">
            <div className="flex items-start gap-3 pr-6">

              {/* Circle complete button */}
              <button
                type="button"
                onClick={handleComplete}
                disabled={completing || task.status === 'done'}
                className={cn(
                  'mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                  completing || task.status === 'done'
                    ? 'bg-[var(--color-success)] border-[var(--color-success)]'
                    : 'border-muted-foreground/40 hover:border-[var(--color-success)] hover:bg-[var(--color-success)]/10'
                )}
                aria-label="Mark complete"
              >
                {(completing || task.status === 'done') && (
                  <Check className="w-3.5 h-3.5 text-white" />
                )}
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

              {/* More menu */}
              <DropdownMenu>
                <DropdownMenuTrigger className="shrink-0 h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onDuplicate && (
                    <DropdownMenuItem onClick={() => {
                      onDuplicate(task.id)
                      toast.success('Task duplicated')
                    }}>
                      <Copy className="w-4 h-4 mr-2" /> Duplicate Task
                    </DropdownMenuItem>
                  )}
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

            {/* Status + Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={status} onValueChange={(v) => handleStatusChange(v as Task['status'])}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_CONFIG.map((s) => (
                      <SelectItem key={s.value} value={s.value} className="text-xs">
                        <span className={cn('font-medium', s.dotColor)}>{s.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                    <SelectItem value="none" className="text-xs">No project</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">
                        <span
                          className="w-2 h-2 rounded-full inline-block mr-1.5"
                          style={{ backgroundColor: p.color }}
                        />
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Due date */}
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

            {/* Tags */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tags</Label>
              <div className="flex flex-wrap gap-1.5 p-2 border rounded-lg min-h-[2.25rem] focus-within:ring-1 focus-within:ring-ring">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="gap-1 text-xs cursor-pointer hover:bg-destructive/10"
                    onClick={() => removeTag(tag)}
                  >
                    #{tag}
                    <X className="w-2.5 h-2.5" />
                  </Badge>
                ))}
                <input
                  className="flex-1 min-w-[80px] bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                  placeholder={tags.length === 0 ? 'Add tag…' : ''}
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={commitTag}
                />
              </div>
              <p className="text-xs text-muted-foreground">Enter or comma to add · Backspace to remove last</p>
            </div>

            {/* Subtasks */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Subtasks
                {subtasks.length > 0 && (
                  <span className="ml-1 text-muted-foreground/60">
                    {doneCount}/{subtasks.length}
                  </span>
                )}
              </Label>

              <div className="flex gap-2">
                <Input
                  ref={subtaskRef}
                  placeholder="Add subtask…"
                  value={subtaskInput}
                  onChange={(e) => setSubtaskInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask() } }}
                  className="flex-1 h-8 text-xs"
                />
                <button
                  type="button"
                  onClick={addSubtask}
                  aria-label="Add subtask"
                  className="h-8 w-8 flex items-center justify-center rounded-md border hover:bg-accent transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1">
                {subtasks.map((sub) => (
                  <div
                    key={sub.id}
                    className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted/50 group"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSubtask(sub.id)}
                      className={cn(
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                        sub.done
                          ? 'bg-primary border-primary'
                          : 'border-muted-foreground/40 hover:border-primary'
                      )}
                    >
                      {sub.done && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </button>
                    <span className={cn(
                      'flex-1 text-xs',
                      sub.done && 'line-through text-muted-foreground'
                    )}>
                      {sub.title}
                    </span>
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
            </div>

            {/* Recurrence — read only */}
            {task.is_recurring && task.recurrence_rule && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-1 border-t">
                <Repeat2 className="w-3.5 h-3.5 shrink-0" />
                <span>Repeats {repeatLabel(task.recurrence_rule)}</span>
              </div>
            )}

            {/* Reminder — read only */}
            {task.reminder_at && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                <Bell className="w-3.5 h-3.5 shrink-0" />
                <span>Reminder: {formatDateTime(task.reminder_at)}</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="shrink-0 px-4 py-3 border-t">
            {completing && (
              <span className="flex items-center gap-1.5 text-sm text-[var(--color-success)] mr-auto">
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
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DateTimePicker overlay — fixed above the Dialog */}
      {showDatePicker && (
        <>
          <div
            className="fixed inset-0 z-[59]"
            onClick={() => setShowDatePicker(false)}
          />
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60]">
            <DateTimePicker
              value={{ date: dueDate || undefined, time: dueTime || undefined }}
              onChange={handleDateTimeChange}
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
        description={`"${task.title}" will be permanently deleted.`}
        confirmLabel="Delete"
        onConfirm={() => {
          onDelete(task.id)
          onClose()
        }}
      />
    </>
  )
}
