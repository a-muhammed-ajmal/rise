'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Check, Trash2, Copy, MoreVertical, Link as LinkIcon,
  Clock, Bell, Repeat2, Plus, X, Star,
  ChevronDown, Paperclip, Flag, Tag, Pencil,
} from 'lucide-react'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { DateTimePicker } from './DateTimePicker'
import { DurationPicker } from './DurationPicker'
import { RepeatEditor } from './RepeatEditor'
import { describeRecurrence } from '@/lib/recurrence'
import { PRIORITY_MAP, PRIORITY_CONFIG, PROJECT_CATEGORIES } from './task-constants'
import { formatRelativeDate, display12h, todayISO } from '@/lib/format'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { useTasks } from '@/lib/hooks/use-tasks'
import type { Task, Subtask, TaskAttachment, ProjectCategory } from '@/lib/types/database'

interface TaskPopupProps {
  task?: Task | null
  projects: Array<{ id: string; name: string; color: string; category: ProjectCategory }>
  defaultProjectId?: string | null
  onClose: () => void
  onCreate: (data: Partial<Task>) => Promise<void>
  /** Called after any write so the parent's useTasks instance re-fetches immediately. */
  refresh?: () => void
}

/**
 * Single popup used everywhere a task is added, created, edited, or viewed.
 * `task` present => live edit/detail mode (autosaves per field).
 * `task` absent  => create mode (local draft, submitted via footer button).
 */
export function TaskPopup({ task, projects, defaultProjectId, onClose, onCreate, refresh }: TaskPopupProps) {
  const { tasks, updateTask, completeTask, reopenTask, deleteTask, duplicateTask, toggleFocus } = useTasks('all')

  const liveTask = task ? (tasks.find((t) => t.id === task.id) ?? task) : null
  const isCreate = !liveTask

  // ── Editable local state ─────────────────────────────────────────────────
  const [title, setTitle] = useState(liveTask?.title ?? '')
  const [description, setDescription] = useState(liveTask?.description ?? '')
  const [priority, setPriority] = useState<Task['priority']>(liveTask?.priority ?? 'P4')
  const [area, setArea] = useState<ProjectCategory>(liveTask?.area ?? 'default')
  const [projectId, setProjectId] = useState(liveTask?.project_id ?? defaultProjectId ?? '')
  const [dueDate, setDueDate] = useState(liveTask?.due_date ?? '')
  const [dueTime, setDueTime] = useState(liveTask?.due_time ?? '')
  const [repeat, setRepeat] = useState(liveTask?.recurrence ?? 'none')
  const [reminderDate, setReminderDate] = useState<string>(() => {
    if (!liveTask?.reminder) return ''
    return liveTask.reminder.slice(0, 10)
  })
  const [reminderTime, setReminderTime] = useState<string>(() => {
    if (!liveTask?.reminder) return ''
    return liveTask.reminder.slice(11, 16)
  })
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    liveTask?.estimated_time?.toString() ?? ''
  )
  const [labels, setLabels] = useState<string[]>(liveTask?.labels ?? [])
  const [subtasks, setSubtasks] = useState<Subtask[]>(liveTask?.subtasks ?? [])
  const [newSubtask, setNewSubtask] = useState('')
  const [attachments, setAttachments] = useState<TaskAttachment[]>(liveTask?.attachments ?? [])
  const [uploading, setUploading] = useState(false)

  // ── UI state ─────────────────────────────────────────────────────────────
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showReminderPicker, setShowReminderPicker] = useState(false)
  const [showDurationPicker, setShowDurationPicker] = useState(false)
  const [showRepeatPicker, setShowRepeatPicker] = useState(false)
  const [showCompletedSubtasks, setShowCompletedSubtasks] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showLabelInput, setShowLabelInput] = useState(false)
  const [newLabelInput, setNewLabelInput] = useState('')

  const titleRef = useRef<HTMLTextAreaElement>(null)
  const subtaskRef = useRef<HTMLInputElement>(null)

  // All unique labels across all tasks — for the labels dropdown
  const allLabels = useMemo(() => {
    const s = new Set<string>()
    tasks.forEach((t) => t.labels?.forEach((l) => s.add(l)))
    return Array.from(s).sort()
  }, [tasks])

  // Projects filtered to the selected area
  const filteredProjects = useMemo(
    () => projects.filter((p) => (p.category ?? 'default') === area),
    [projects, area],
  )

  // Auto-grow title textarea
  useEffect(() => {
    const el = titleRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${el.scrollHeight}px`
    }
  }, [title])

  function commit(patch: Partial<Task>) {
    if (liveTask) {
      updateTask(liveTask.id, patch)
        .then(() => refresh?.())
        .catch((err: Error) => {
          toast.error(`Update failed: ${err.message}`)
        })
    }
  }

  /** Close all picker overlays — ensures only one is open at a time */
  function closeAllPickers() {
    setShowDatePicker(false)
    setShowReminderPicker(false)
    setShowDurationPicker(false)
    setShowRepeatPicker(false)
  }

  // ── Field handlers ────────────────────────────────────────────────────────

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

  function handleAreaChange(v: ProjectCategory) {
    setArea(v)
    commit({ area: v })
    // Clear project if it no longer belongs to the new area
    const currentProj = projects.find((p) => p.id === projectId)
    if (currentProj && (currentProj.category ?? 'default') !== v) {
      setProjectId('')
      commit({ project_id: null })
    }
  }

  function handleProjectChange(v: string | null) {
    const id = (!v || v === 'none') ? null : v
    setProjectId(id ?? '')
    commit({ project_id: id })
    // Auto-sync area to match the picked project's category
    if (id) {
      const proj = projects.find((p) => p.id === id)
      if (proj && (proj.category ?? 'default') !== area) {
        setArea(proj.category ?? 'default')
        commit({ area: proj.category ?? 'default' })
      }
    }
  }

  function handleDateChange(date: Date) {
    const nextDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const nextTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    setDueDate(nextDate)
    setDueTime(nextTime)
    commit({ due_date: nextDate, due_time: nextTime })
  }

  function handleRepeatChange(v: string) {
    setRepeat(v)
    commit({ recurrence: v === 'none' ? null : v })
  }

  function clearDueDate() {
    setDueDate('')
    setDueTime('')
    commit({ due_date: null, due_time: null })
  }

  function clearReminder() {
    setReminderDate('')
    setReminderTime('')
    commit({ reminder: null })
  }

  function handleReminderChange(date: Date) {
    const nextDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const nextTime = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
    setReminderDate(nextDate)
    setReminderTime(nextTime)
    const iso = nextDate ? new Date(`${nextDate}T${nextTime}:00`).toISOString() : null
    commit({ reminder: iso })
  }

  function handleDurationChange(totalMinutes: number) {
    const val = totalMinutes > 0 ? totalMinutes.toString() : ''
    setEstimatedMinutes(val)
    commit({ estimated_time: totalMinutes > 0 ? totalMinutes : null })
  }

  // ── Labels ───────────────────────────────────────────────────────────────

  function toggleLabel(label: string) {
    const updated = labels.includes(label)
      ? labels.filter((x) => x !== label)
      : [...labels, label]
    setLabels(updated)
    commit({ labels: updated })
  }

  function addNewLabel() {
    const l = newLabelInput.trim().toLowerCase()
    if (l && !labels.includes(l)) {
      const updated = [...labels, l]
      setLabels(updated)
      commit({ labels: updated })
    }
    setNewLabelInput('')
    setShowLabelInput(false)
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

  // ── Complete / Reopen / Delete / Duplicate ────────────────────────────────

  async function handleComplete() {
    if (!liveTask) return
    setCompleting(true)
    await completeTask(liveTask.id)
    refresh?.()
    setTimeout(onClose, 1500)
  }

  function handleReopen() {
    if (!liveTask) return
    reopenTask(liveTask.id)
    refresh?.()
    setCompleting(false)
  }

  function handleCopyLink() {
    if (!liveTask) return
    navigator.clipboard.writeText(`${window.location.origin}/productivity#task-${liveTask.id}`)
    toast.success('Link copied')
  }

  // Marking a task as "today's focus": only for today, max 3 per day.
  function handleToggleFocus(t: Task) {
    if (t.is_focus) {
      toggleFocus(t.id)
      refresh?.()
      return
    }
    if (t.due_date && t.due_date > todayISO()) {
      toast.error('You can only focus on tasks due today')
      return
    }
    const focusedToday = tasks.filter((x) => x.is_focus && x.focus_date === todayISO()).length
    if (focusedToday >= 3) {
      toast.error('You can only focus on 3 tasks a day')
      return
    }
    toggleFocus(t.id)
    refresh?.()
  }

  // ── Create submit ─────────────────────────────────────────────────────────

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
        reminder: reminderDate
          ? new Date(`${reminderDate}T${reminderTime || '09:00'}:00`).toISOString()
          : null,
        estimated_time: estimatedMinutes ? parseInt(estimatedMinutes, 10) : null,
        project_id: projectId || null,
        area,
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

  const reminderSummary = reminderDate
    ? `${formatRelativeDate(reminderDate)}${reminderTime ? ` · ${display12h(reminderTime)}` : ''}`
    : null

  function durationLabel() {
    const mins = parseInt(estimatedMinutes, 10) || 0
    if (!mins) return 'Duration'
    const h = Math.floor(mins / 60)
    const m = mins % 60
    if (h > 0 && m > 0) return `${h}h ${m}m`
    if (h > 0) return `${h}h`
    return `${m}m`
  }

  return (
    <>
      <ResponsiveModal ariaLabel={isCreate ? 'Add task' : 'Task detail'} open onOpenChange={(v) => {
        if (!v) {
          if (isCreate && title.trim()) {
            onCreate({
              title: title.trim(),
              description: description.trim() || null,
              priority,
              status: 'todo',
              due_date: dueDate || null,
              due_time: dueTime || null,
              recurrence: repeat === 'none' ? null : repeat,
              reminder: reminderDate
                ? new Date(`${reminderDate}T${reminderTime || '09:00'}:00`).toISOString()
                : null,
              estimated_time: estimatedMinutes ? parseInt(estimatedMinutes, 10) : null,
              project_id: projectId || null,
              area,
              labels,
              subtasks,
              attachments,
            }).catch(() => toast.error('Failed to add task'))
          }
          onClose()
        }
      }}>
        <form onSubmit={handleFormSubmit} className="flex flex-col flex-1 min-h-0">

            {/* Header */}
            <div className="shrink-0 px-4 py-3 border-b">
              <div className="flex items-center gap-2">
                <h2 className="text-sm flex-1 font-heading font-semibold">
                  {isCreate ? 'Add new task' : 'Update the task'}
                </h2>
                {!isCreate && (
                  <>
                    <button
                      type="button"
                      onClick={() => liveTask && handleToggleFocus(liveTask)}
                      className={cn(
                        'tap-target shrink-0 transition-colors',
                        liveTask.is_focus
                          ? 'text-[var(--color-warning)]'
                          : 'text-muted-foreground/30 hover:text-[var(--color-warning)]'
                      )}
                      aria-label={liveTask.is_focus ? "Remove from today's focus" : "Mark as today's focus"}
                    >
                      <Star className={cn('w-4 h-4', liveTask.is_focus && 'fill-[var(--color-warning)]')} />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="tap-target shrink-0 rounded-md hover:bg-accent transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          duplicateTask(liveTask.id)
                          refresh?.()
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
                  </>
                )}
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto space-y-3 px-4 py-3">

              {/* Task title */}
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
              </div>

              {/* Notes / Description */}
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

              {/* Subtasks — no label above, inline box with icon + placeholder */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 px-3 h-11 rounded-md border border-input bg-transparent focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/15 transition-colors shadow-card">
                  <Plus className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
                  <input
                    ref={subtaskRef}
                    placeholder="Add subtask…"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSubtask() } }}
                    className="flex-1 text-sm outline-none bg-transparent placeholder:text-muted-foreground font-medium"
                    aria-label="New subtask"
                  />
                  {newSubtask && (
                    <button
                      type="button"
                      onClick={handleAddSubtask}
                      aria-label="Add subtask"
                      className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Active subtasks */}
                {activeSubtasks.length > 0 && (
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
                )}

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
                      {subtasks.length > 0 && (
                        <span className="text-muted-foreground/60 ml-0.5">
                          · {doneSubtasks}/{subtasks.length}
                        </span>
                      )}
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

              {/* Priority [30%] + Time [70%] — no labels above */}
              <div className="grid grid-cols-[3fr_7fr] gap-2">
                {/* Priority */}
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

                {/* Time */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { closeAllPickers(); setShowDatePicker((v) => !v) }}
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
                      onClick={(e) => { e.stopPropagation(); clearDueDate() }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Clear time"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Repeat | Reminder | Duration — 3 equal columns, no labels above */}
              <div className="grid grid-cols-3 gap-2">
                {/* Repeat */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { closeAllPickers(); setShowRepeatPicker((v) => !v) }}
                    className={cn(
                      'w-full h-9 flex items-center gap-1.5 px-3 rounded-lg border text-xs transition-colors',
                      repeat !== 'none'
                        ? 'border-brand/50 text-brand bg-brand-tint pr-7'
                        : 'border-border text-muted-foreground hover:border-ring'
                    )}
                    aria-label={repeat !== 'none' ? `Repeat: ${describeRecurrence(repeat)}` : 'Set repeat'}
                  >
                    <Repeat2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate flex-1 text-left">
                      {repeat !== 'none' ? describeRecurrence(repeat) : 'Repeat'}
                    </span>
                  </button>
                  {repeat !== 'none' && (
                    <button
                      type="button"
                      onClick={() => handleRepeatChange('none')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive transition-colors z-10"
                      aria-label="Clear repeat"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Reminder */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { closeAllPickers(); setShowReminderPicker((v) => !v) }}
                    className={cn(
                      'w-full h-9 flex items-center gap-1.5 px-3 rounded-lg border text-xs transition-colors',
                      reminderDate
                        ? 'border-brand/50 text-brand bg-brand-tint pr-8'
                        : 'border-border text-muted-foreground hover:border-ring'
                    )}
                    aria-label={reminderDate ? `Change reminder: ${reminderSummary}` : 'Set reminder'}
                  >
                    <Bell className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {reminderDate ? reminderSummary : 'Reminder'}
                    </span>
                  </button>
                  {reminderDate && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); clearReminder() }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Clear reminder"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Duration */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => { closeAllPickers(); setShowDurationPicker((v) => !v) }}
                    className={cn(
                      'w-full h-9 flex items-center gap-1.5 px-3 rounded-lg border text-xs transition-colors',
                      estimatedMinutes
                        ? 'border-brand/50 text-brand bg-brand-tint pr-8'
                        : 'border-border text-muted-foreground hover:border-ring'
                    )}
                    aria-label={estimatedMinutes ? `Change duration: ${durationLabel()}` : 'Set duration'}
                  >
                    <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{durationLabel()}</span>
                  </button>
                  {estimatedMinutes && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDurationChange(0) }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Clear duration"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Area + Project */}
              <div className="grid grid-cols-2 gap-2">
                {/* Area */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Area</Label>
                  <Select value={area} onValueChange={(v) => handleAreaChange(v as ProjectCategory)}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {(() => {
                          const cat = PROJECT_CATEGORIES.find((c) => c.value === area)
                          return cat ? (
                            <>
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                              <span className="truncate">{cat.label}</span>
                            </>
                          ) : <SelectValue />
                        })()}
                      </div>
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      {PROJECT_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value} className="text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                            {cat.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Project — filtered to selected area */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    <Tag className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" />
                    Project
                  </Label>
                  <Select value={projectId || 'none'} onValueChange={handleProjectChange}>
                    <SelectTrigger className="h-9 w-full text-xs">
                      <SelectValue placeholder="Inbox" />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectItem value="none" className="text-xs">Inbox</SelectItem>
                      {filteredProjects.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                            {p.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Labels + Attachments — same row, no labels above */}
              <div className="space-y-2">
                <div className="flex gap-2">
                  {/* Labels dropdown */}
                  <DropdownMenu onOpenChange={(open) => {
                    if (!open) { setShowLabelInput(false); setNewLabelInput('') }
                  }}>
                    <DropdownMenuTrigger
                      className={cn(
                        'flex-1 h-9 flex items-center gap-1.5 px-3 rounded-lg border text-xs transition-colors',
                        labels.length > 0
                          ? 'border-brand/50 text-brand bg-brand-tint'
                          : 'border-border text-muted-foreground hover:border-ring'
                      )}
                      aria-label="Labels"
                    >
                      <Tag className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                      <span className="flex-1 text-left truncate">
                        {labels.length > 0
                          ? labels.length === 1 ? `#${labels[0]}` : `${labels.length} labels`
                          : 'Labels'}
                      </span>
                      <ChevronDown className="w-3 h-3 shrink-0 ml-auto" aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-[160px]">
                      {allLabels.map((label) => (
                        <DropdownMenuCheckboxItem
                          key={label}
                          checked={labels.includes(label)}
                          onCheckedChange={() => toggleLabel(label)}
                          className="text-xs"
                        >
                          #{label}
                        </DropdownMenuCheckboxItem>
                      ))}
                      {allLabels.length > 0 && <DropdownMenuSeparator />}
                      {showLabelInput ? (
                        <div
                          className="flex items-center gap-1.5 px-1.5 py-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            autoFocus
                            placeholder="Label name…"
                            value={newLabelInput}
                            onChange={(e) => setNewLabelInput(e.target.value)}
                            onKeyDown={(e) => {
                              e.stopPropagation()
                              if (e.key === 'Enter') addNewLabel()
                              if (e.key === 'Escape') { setShowLabelInput(false); setNewLabelInput('') }
                            }}
                            className="flex-1 text-xs outline-none bg-transparent placeholder:text-muted-foreground min-w-0"
                          />
                          <button
                            type="button"
                            onClick={addNewLabel}
                            className="text-[11px] font-semibold text-brand shrink-0"
                          >
                            Add
                          </button>
                        </div>
                      ) : (
                        <DropdownMenuItem
                          className="text-xs"
                          onClick={() => setShowLabelInput(true)}
                        >
                          <Plus className="w-3 h-3" />
                          Add new
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Attachment button */}
                  <label
                    className={cn(
                      'flex items-center gap-1.5 px-3 h-9 rounded-lg border text-xs cursor-pointer transition-colors',
                      attachments.length > 0
                        ? 'border-brand/50 text-brand bg-brand-tint'
                        : 'border-border text-muted-foreground hover:border-ring'
                    )}
                    aria-label="Attach file"
                  >
                    <Paperclip className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{uploading ? 'Uploading…' : attachments.length > 0 ? `${attachments.length} file${attachments.length > 1 ? 's' : ''}` : 'Attach'}</span>
                    <input
                      type="file"
                      className="sr-only"
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                </div>

                {/* Selected label chips */}
                {labels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
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
                  </div>
                )}

                {/* Attachment list */}
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

            </div>

            {/* Footer */}
            <div className="shrink-0 px-4 py-3 border-t flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-3 text-xs rounded-md hover:bg-accent transition-colors text-muted-foreground"
              >
                Close
              </button>
              {isCreate && (
                <button
                  type="submit"
                  disabled={saving || !title.trim()}
                  className="min-h-[44px] px-4 text-xs rounded-md font-semibold bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Adding…' : 'Add task'}
                </button>
              )}
            </div>
          </form>
      </ResponsiveModal>

      {/* DateTimePicker overlay — due date/time */}
      {showDatePicker && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/20" onClick={() => setShowDatePicker(false)} />
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[71]">
            <DateTimePicker
              initialDate={dueDate ? new Date(`${dueDate}T${dueTime || '09:00'}:00`) : new Date()}
              onSave={(d) => { handleDateChange(d); setShowDatePicker(false) }}
              onCancel={() => setShowDatePicker(false)}
            />
          </div>
        </>
      )}

      {/* DateTimePicker overlay — reminder */}
      {showReminderPicker && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/20" onClick={() => setShowReminderPicker(false)} />
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[71]">
            <DateTimePicker
              initialDate={reminderDate ? new Date(`${reminderDate}T${reminderTime || '09:00'}:00`) : new Date()}
              onSave={(d) => { handleReminderChange(d); setShowReminderPicker(false) }}
              onCancel={() => setShowReminderPicker(false)}
            />
          </div>
        </>
      )}

      {/* DurationPicker overlay */}
      {showDurationPicker && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/20" onClick={() => setShowDurationPicker(false)} />
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[71]">
            <DurationPicker
              value={parseInt(estimatedMinutes, 10) || 0}
              onChange={handleDurationChange}
              onClose={() => setShowDurationPicker(false)}
            />
          </div>
        </>
      )}

      {/* RepeatEditor overlay */}
      {showRepeatPicker && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/20" onClick={() => setShowRepeatPicker(false)} />
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[71]">
            <RepeatEditor
              value={repeat !== 'none' ? repeat : null}
              dueDate={dueDate || null}
              onChange={(v) => { handleRepeatChange(v ?? 'none'); setShowRepeatPicker(false) }}
              onClose={() => setShowRepeatPicker(false)}
            />
          </div>
        </>
      )}

      {/* Delete confirmation — edit mode only */}
      {liveTask && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Delete task?"
          description={`"${liveTask.title}" will be permanently deleted.`}
          confirmLabel="Delete"
          onConfirm={() => {
            deleteTask(liveTask.id)
            refresh?.()
            onClose()
          }}
        />
      )}
    </>
  )
}
