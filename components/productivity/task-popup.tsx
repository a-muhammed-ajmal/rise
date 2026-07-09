'use client'

import { useState, useRef, useEffect } from 'react'
import {
  Check, Trash2, Copy, MoreVertical, Link as LinkIcon,
  Clock, Bell, Repeat2, Plus, X, Star,
  MessageSquare, ChevronDown, Paperclip, Flag, Tag, Pencil,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { PRIORITY_MAP, PRIORITY_CONFIG, repeatLabel } from './task-constants'
import { formatRelativeDate, formatDateTime, display12h } from '@/lib/format'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useTasks } from '@/lib/hooks/use-tasks'
import type { Task, Subtask, TaskAttachment } from '@/lib/types/database'

interface TaskPopupProps {
  task?: Task | null
  projects: Array<{ id: string; name: string; color: string }>
  defaultProjectId?: string | null
  onClose: () => void
  onCreate: (data: Partial<Task>) => Promise<void>
}

/**
 * Single popup used everywhere a task is added, created, edited, or viewed.
 * `task` present => live edit/detail mode (autosaves per field).
 * `task` absent  => create mode (local draft, submitted via footer button).
 */
export function TaskPopup({ task, projects, defaultProjectId, onClose, onCreate }: TaskPopupProps) {
  const { tasks, updateTask, completeTask, reopenTask, deleteTask, duplicateTask, toggleFocus, addComment } = useTasks('all')

  const liveTask = task ? (tasks.find((t) => t.id === task.id) ?? task) : null
  const isCreate = !liveTask

  // ── Editable local state — shared draft for both create + edit modes ───────
  const [title, setTitle] = useState(liveTask?.title ?? '')
  const [description, setDescription] = useState(liveTask?.description ?? '')
  const [priority, setPriority] = useState<Task['priority']>(liveTask?.priority ?? 'P4')
  const [projectId, setProjectId] = useState(liveTask?.project_id ?? defaultProjectId ?? '')
  const [dueDate, setDueDate] = useState(liveTask?.due_date ?? '')
  const [dueTime, setDueTime] = useState(liveTask?.due_time ?? '')
  const [repeat, setRepeat] = useState(liveTask?.recurrence ?? 'none')
  const [reminderAt, setReminderAt] = useState(
    liveTask?.reminder ? liveTask.reminder.slice(0, 16) : ''
  )
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    liveTask?.estimated_time?.toString() ?? ''
  )
  const [labels, setLabels] = useState<string[]>(liveTask?.labels ?? [])
  const [labelInput, setLabelInput] = useState('')
  const [subtasks, setSubtasks] = useState<Subtask[]>(liveTask?.subtasks ?? [])
  const [newSubtask, setNewSubtask] = useState('')
  const [attachments, setAttachments] = useState<TaskAttachment[]>(liveTask?.attachments ?? [])
  const [uploading, setUploading] = useState(false)
  const [comment, setComment] = useState('')

  // ── UI state ─────────────────────────────────────────────────────────────
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showCompletedSubtasks, setShowCompletedSubtasks] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [saving, setSaving] = useState(false)

  const titleRef = useRef<HTMLTextAreaElement>(null)
  const subtaskRef = useRef<HTMLInputElement>(null)

  // Auto-grow title textarea
  useEffect(() => {
    const el = titleRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [title])

  // Persist a field immediately — only meaningful once the task exists
  function commit(patch: Partial<Task>) {
    if (liveTask) updateTask(liveTask.id, patch)
  }

  // ── Field handlers (update local state, autosave when editing) ─────────────

  function handleTitleBlur() {
    const t = title.trim()
    if (!liveTask) return
    if (t && t !== liveTask.title) commit({ title: t })
    else if (!t) setTitle(liveTask.title)
  }

  function handleDescriptionBlur() {
    if (!liveTask) return
    const d = description.trim() || null
    if (d !== liveTask.description) commit({ description: d })
  }

  function handlePriorityChange(p: Task['priority'] | null) {
    if (!p) return
    setPriority(p)
    commit({ priority: p })
  }

  function handleProjectChange(v: string | null) {
    const id = (!v || v === 'none') ? null : v
    setProjectId(id ?? '')
    commit({ project_id: id })
  }

  function handleDateChange(v: { date?: string; time?: string }) {
    setDueDate(v.date ?? '')
    setDueTime(v.time ?? '')
    commit({ due_date: v.date ?? null, due_time: v.time ?? null })
  }

  function handleRepeatChange(v: string | null) {
    if (v === null) return
    setRepeat(v)
    commit({ recurrence: v === 'none' ? null : v })
  }

  function handleReminderChange(v: string) {
    setReminderAt(v)
    commit({ reminder: v ? new Date(v).toISOString() : null })
  }

  function handleDurationBlur() {
    if (!liveTask) return
    const parsed = estimatedMinutes ? parseInt(estimatedMinutes, 10) : null
    if (parsed !== liveTask.estimated_time) commit({ estimated_time: parsed })
  }

  // ── Labels ───────────────────────────────────────────────────────────────

  function commitLabel() {
    const l = labelInput.trim().toLowerCase()
    if (l && !labels.includes(l)) {
      const updated = [...labels, l]
      setLabels(updated)
      commit({ labels: updated })
    }
    setLabelInput('')
  }

  function toggleLabel(label: string) {
    const updated = labels.includes(label)
      ? labels.filter((x) => x !== label)
      : [...labels, label]
    setLabels(updated)
    commit({ labels: updated })
  }

  function handleLabelKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitLabel() }
    else if (e.key === 'Backspace' && !labelInput) {
      const updated = labels.slice(0, -1)
      setLabels(updated)
      commit({ labels: updated })
    }
  }

  // ── Subtasks ─────────────────────────────────────────────────────────────

  function handleAddSubtask() {
    const t = newSubtask.trim()
    if (!t) return
    const updated: Subtask[] = [...subtasks, { id: crypto.randomUUID(), title: t, done: false }]
    setSubtasks(updated)
    setNewSubtask('')
    commit({ subtasks: updated })
    setTimeout(() => subtaskRef.current?.focus(), 0)
  }

  function toggleSubtask(id: string) {
    const updated = subtasks.map((s) => s.id === id ? { ...s, done: !s.done } : s)
    setSubtasks(updated)
    commit({ subtasks: updated })
  }

  function removeSubtask(id: string) {
    const updated = subtasks.filter((s) => s.id !== id)
    setSubtasks(updated)
    commit({ subtasks: updated })
  }

  // ── Attachments ──────────────────────────────────────────────────────────

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Not authenticated'); return }
      const path = `${user.id}/${Date.now()}-${file.name}`
      const { error } = await supabase.storage.from('task-attachments').upload(path, file)
      if (error) { toast.error('Upload failed'); return }
      const { data: urlData } = supabase.storage.from('task-attachments').getPublicUrl(path)
      const updated = [...attachments, { name: file.name, url: urlData.publicUrl, type: file.type }]
      setAttachments(updated)
      commit({ attachments: updated })
      toast.success('File attached')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  function removeAttachment(index: number) {
    const updated = attachments.filter((_, i) => i !== index)
    setAttachments(updated)
    commit({ attachments: updated })
  }

  // ── Comments (edit mode only — requires an existing task) ───────────────────

  async function handleAddComment() {
    if (!liveTask) return
    const t = comment.trim()
    if (!t) return
    await addComment(liveTask.id, t)
    setComment('')
  }

  // ── Complete / Reopen / Delete / Duplicate ──────────────────────────────────

  function handleComplete() {
    if (!liveTask) return
    setCompleting(true)
    completeTask(liveTask.id)
    setTimeout(onClose, 1500)
  }

  function handleReopen() {
    if (!liveTask) return
    reopenTask(liveTask.id)
    setCompleting(false)
  }

  function handleCopyLink() {
    if (!liveTask) return
    navigator.clipboard.writeText(`${window.location.origin}/productivity#task-${liveTask.id}`)
    toast.success('Link copied')
  }

  // ── Create submit ────────────────────────────────────────────────────────

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isCreate) return
    const t = title.trim()
    if (!t) return
    setSaving(true)
    try {
      await onCreate({
        title: t,
        description: description.trim() || null,
        priority,
        status: 'todo',
        due_date: dueDate || null,
        due_time: dueTime || null,
        recurrence: repeat === 'none' ? null : repeat,
        reminder: reminderAt ? new Date(reminderAt).toISOString() : null,
        estimated_time: estimatedMinutes ? parseInt(estimatedMinutes, 10) : null,
        project_id: projectId || null,
        labels,
        subtasks,
        attachments,
      })
      onClose()
    } catch {
      toast.error('Failed to add task')
    } finally {
      setSaving(false)
    }
  }

  const doneSubtasks = subtasks.filter((s) => s.done).length
  const activeSubtasks = subtasks.filter((s) => !s.done)
  const doneSubtaskList = subtasks.filter((s) => s.done)

  const isCompleted = (liveTask?.is_completed ?? false) || completing

  const dueSummary = dueDate
    ? `${formatRelativeDate(dueDate)}${dueTime ? ` · ${display12h(dueTime)}` : ''}`
    : null

  return (
    <>
      <Dialog open onOpenChange={(v) => { if (!v) onClose() }}>
        <DialogContent className="sm:max-w-lg max-h-[92vh] flex flex-col overflow-hidden p-0">
          <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0">

            {/* Header — popup heading at same level as close button */}
            <DialogHeader className="shrink-0 px-4 py-3 border-b">
              <DialogTitle className="text-sm pr-10">
                {isCreate ? 'Add new task' : 'Update the task'}
              </DialogTitle>
            </DialogHeader>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto space-y-4 px-4 py-3">

              {/* Task title + actions */}
              <div className="flex items-start gap-2">
                {!isCreate && (
                  <button
                    type="button"
                    onClick={isCompleted ? handleReopen : handleComplete}
                    className="tap-target -m-2.5 mt-0 mr-0.5 shrink-0"
                    aria-label={isCompleted ? 'Reopen task' : 'Mark complete'}
                  >
                    <span className={cn(
                      'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
                      isCompleted
                        ? 'bg-[var(--color-success)] border-[var(--color-success)]'
                        : 'border-muted-foreground/40 hover:border-[var(--color-success)] hover:bg-[var(--color-success)]/10'
                    )}>
                      {isCompleted && <Check className="w-3.5 h-3.5 text-white" />}
                    </span>
                  </button>
                )}
                <Textarea
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  placeholder="What needs to be done?"
                  autoFocus
                  className="flex-1 resize-none text-base font-medium border-0 p-0 shadow-none focus-visible:ring-0 min-h-[1.5rem] overflow-hidden"
                  rows={1}
                />
                {!isCreate && (
                  <button
                    type="button"
                    onClick={() => toggleFocus(liveTask.id)}
                    className={cn(
                      'tap-target -m-2.5 shrink-0 transition-colors',
                      liveTask.is_focus
                        ? 'text-[var(--color-warning)]'
                        : 'text-muted-foreground/30 hover:text-[var(--color-warning)]'
                    )}
                    aria-label={liveTask.is_focus ? 'Remove from focus' : 'Add to focus'}
                  >
                    <Star className={cn('w-4 h-4', liveTask.is_focus && 'fill-[var(--color-warning)]')} />
                  </button>
                )}
                {!isCreate && (
                  <DropdownMenu>
                    <DropdownMenuTrigger className="tap-target -m-2.5 shrink-0 rounded-md hover:bg-accent transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        duplicateTask(liveTask.id)
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
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Textarea
                  placeholder="Add notes…"
                  icon={<Pencil aria-hidden="true" />}
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

              {/* Priority + Time — 30 / 70 single row, no label above */}
              <div className="grid grid-cols-[3fr_7fr] gap-2">
                {/* Priority 30% */}
                <Select value={priority} onValueChange={(v) => handlePriorityChange(v as Task['priority'])}>
                  <SelectTrigger className="h-9 text-xs w-full" aria-label="Priority">
                    <div className="flex items-center gap-1.5">
                      <Flag
                        className={cn('w-3.5 h-3.5 shrink-0', PRIORITY_CONFIG[priority].textClass)}
                        aria-hidden="true"
                      />
                      <span>{priority}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent align="start" alignItemWithTrigger={false}>
                    {PRIORITY_MAP.map((p) => (
                      <SelectItem key={p.value} value={p.value} className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <Flag
                            className={cn('w-3.5 h-3.5 shrink-0', PRIORITY_CONFIG[p.value].textClass)}
                            aria-hidden="true"
                          />
                          <span>{p.value}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Time 70% */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowDatePicker((v) => !v)}
                    className={cn(
                      'w-full h-9 flex items-center gap-1.5 px-3 rounded-lg border text-xs transition-colors',
                      dueDate
                        ? 'border-brand/50 text-brand bg-brand-tint pr-8'
                        : 'border-border text-muted-foreground hover:border-ring'
                    )}
                    aria-label={dueDate ? `Change time: ${dueSummary}` : 'Set time'}
                  >
                    <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {dueDate
                        ? `${formatRelativeDate(dueDate)}${dueTime ? ` · ${display12h(dueTime)}` : ''}`
                        : 'Set time'}
                    </span>
                  </button>
                  {dueDate && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDateChange({}) }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Clear time"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Repeat */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  <Repeat2 className="w-3.5 h-3.5 inline mr-1" />
                  Repeat
                </Label>
                <Select value={repeat} onValueChange={handleRepeatChange}>
                  <SelectTrigger className="h-9 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    <SelectItem value="none" className="text-xs">No repeat</SelectItem>
                    <SelectItem value="FREQ=DAILY" className="text-xs">Daily</SelectItem>
                    <SelectItem value="FREQ=WEEKLY" className="text-xs">Weekly</SelectItem>
                    <SelectItem value="FREQ=MONTHLY" className="text-xs">Monthly</SelectItem>
                    <SelectItem value="FREQ=YEARLY" className="text-xs">Yearly</SelectItem>
                    <SelectItem value="FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" className="text-xs">Weekdays</SelectItem>
                  </SelectContent>
                </Select>
                {!isCreate && repeat !== 'none' && (
                  <p className="text-xs text-muted-foreground pl-0.5">Repeats {repeatLabel(repeat)}</p>
                )}
              </div>

              {/* Reminder + Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="tp-reminder" className="text-xs text-muted-foreground">
                    <Bell className="w-3.5 h-3.5 inline mr-1" />
                    Reminder
                  </Label>
                  <Input
                    id="tp-reminder"
                    type="datetime-local"
                    value={reminderAt}
                    onChange={(e) => handleReminderChange(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tp-duration" className="text-xs text-muted-foreground">
                    <Clock className="w-3.5 h-3.5 inline mr-1" />
                    Duration (min)
                  </Label>
                  <Input
                    id="tp-duration"
                    type="number"
                    min="1"
                    placeholder="e.g. 30"
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(e.target.value)}
                    onBlur={handleDurationBlur}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
              {!isCreate && liveTask.reminder && (
                <p className="text-xs text-muted-foreground -mt-2">
                  Reminder set for {formatDateTime(liveTask.reminder)}
                </p>
              )}

              {/* Project */}
              {projects.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    <Tag className="w-3.5 h-3.5 inline mr-1" />
                    Project
                  </Label>
                  <Select value={projectId || 'none'} onValueChange={handleProjectChange}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="No project" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectItem value="none" className="text-xs">Inbox</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          <span className="w-2 h-2 rounded-full inline-block mr-1.5 shrink-0" style={{ backgroundColor: p.color }} />
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Labels */}
              <div className="space-y-1.5">
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
                    className="flex-1 h-9 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddSubtask}
                    aria-label="Add subtask"
                    className="relative shrink-0 h-9 w-9 flex items-center justify-center rounded-lg border hover:bg-accent transition-colors before:absolute before:inset-[-4px] before:content-['']"
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

              {/* Attachments */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  <Paperclip className="w-3.5 h-3.5 inline mr-1" />
                  Attachments
                </Label>
                <label className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                  <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    {uploading ? 'Uploading…' : 'Attach a file'}
                  </span>
                  <input
                    type="file"
                    className="sr-only"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
                {attachments.length > 0 && (
                  <div className="space-y-1">
                    {attachments.map((att, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-muted/50 group">
                        <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 text-xs truncate hover:underline"
                        >
                          {att.name}
                        </a>
                        <button
                          type="button"
                          aria-label={`Remove attachment: ${att.name}`}
                          onClick={() => removeAttachment(i)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Comments + Activity — edit mode only (need an existing task id) */}
              {!isCreate && (
                <div className="space-y-2 border-t pt-3">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" />
                    Comments
                    {liveTask.comments.length > 0 && (
                      <span className="text-muted-foreground/60">{liveTask.comments.length}</span>
                    )}
                  </Label>

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

                  <div className="flex gap-2">
                    <Input
                      placeholder="Write a comment…"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment() } }}
                      className="flex-1 h-9 text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddComment}
                      disabled={!comment.trim()}
                      aria-label="Add comment"
                      className="relative shrink-0 h-9 w-9 flex items-center justify-center rounded-lg border hover:bg-accent transition-colors disabled:opacity-50 before:absolute before:inset-[-4px] before:content-['']"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

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
              )}
            </div>

            {/* Footer */}
            <DialogFooter className="shrink-0 px-4 py-3 border-t flex items-center justify-between">
              {isCreate ? (
                <>
                  <button
                    type="button"
                    onClick={onClose}
                    className="h-9 px-3 text-xs rounded-md hover:bg-accent transition-colors text-muted-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || !title.trim()}
                    className="h-9 px-4 text-xs rounded-md font-semibold bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Adding…' : 'Add Task'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="h-9 px-3 text-xs rounded-md text-destructive hover:bg-destructive/10 transition-colors"
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
                      className="h-9 px-3 text-xs rounded-md hover:bg-accent transition-colors text-muted-foreground"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={isCompleted ? handleReopen : handleComplete}
                      className={cn(
                        'h-9 px-3 text-xs rounded-md font-medium transition-colors',
                        isCompleted
                          ? 'bg-muted text-muted-foreground hover:bg-accent'
                          : 'bg-[var(--color-success)]/10 text-[var(--color-success)] hover:bg-[var(--color-success)]/20'
                      )}
                    >
                      {isCompleted ? 'Reopen' : 'Mark Complete'}
                    </button>
                  </div>
                </>
              )}
            </DialogFooter>
          </form>
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

      {/* Delete confirmation — edit mode only */}
      {!isCreate && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete task?"
          description={`"${liveTask.title}" will be permanently deleted.`}
          confirmLabel="Delete"
          onConfirm={() => {
            deleteTask(liveTask.id)
            onClose()
          }}
        />
      )}
    </>
  )
}
