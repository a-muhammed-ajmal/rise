'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { Task, Subtask, TaskAttachment } from '@/lib/types/database'
import {
  Plus,
  X,
  Check,
  CalendarDays,
  Bell,
  Paperclip,
  Repeat2,
  Clock,
  Trash2,
  Flag,
  Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

const PRIORITY_OPTIONS: Array<{ value: Task['priority']; label: string; dot: string }> = [
  { value: 'P1', label: 'P1 — Urgent', dot: 'bg-[var(--color-danger)]' },
  { value: 'P2', label: 'P2 — High',   dot: 'bg-[var(--color-warning)]' },
  { value: 'P3', label: 'P3 — Normal', dot: 'bg-[var(--color-info)]' },
  { value: 'P4', label: 'P4 — Low',    dot: 'bg-[var(--color-p4)]' },
]

interface TaskFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: Partial<Task>) => Promise<void>
  initial?: Partial<Task>
  title?: string
  projects?: Array<{ id: string; name: string; color: string }>
  defaultProjectId?: string | null
}

export function TaskForm({
  open,
  onOpenChange,
  onSubmit,
  initial,
  title = 'New Task',
  projects = [],
  defaultProjectId,
}: TaskFormProps) {
  const [taskTitle, setTaskTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [priority, setPriority] = useState<Task['priority']>(initial?.priority ?? 'P3')

  const [dueDate, setDueDate] = useState(initial?.due_date ?? '')
  const [dueTime, setDueTime] = useState(initial?.due_time ?? '')
  const [repeat, setRepeat] = useState(initial?.recurrence ?? 'none')
  const [reminderAt, setReminderAt] = useState(
    initial?.reminder ? initial.reminder.slice(0, 16) : ''
  )
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    initial?.estimated_time?.toString() ?? ''
  )

  const [projectId, setProjectId] = useState(
    initial?.project_id ?? defaultProjectId ?? ''
  )
  const [tags, setTags] = useState<string[]>(initial?.labels ?? [])
  const [tagInput, setTagInput] = useState('')

  const [subtasks, setSubtasks] = useState<Subtask[]>(initial?.subtasks ?? [])
  const [subtaskInput, setSubtaskInput] = useState('')

  const [attachments, setAttachments] = useState<TaskAttachment[]>(initial?.attachments ?? [])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const resetForm = useCallback(() => {
    setTaskTitle(initial?.title ?? '')
    setDescription(initial?.description ?? '')
    setPriority(initial?.priority ?? 'P3')
    setDueDate(initial?.due_date ?? '')
    setDueTime(initial?.due_time ?? '')
    setRepeat(initial?.recurrence ?? 'none')
    setReminderAt(initial?.reminder ? initial.reminder.slice(0, 16) : '')
    setEstimatedMinutes(initial?.estimated_time?.toString() ?? '')
    setProjectId(initial?.project_id ?? defaultProjectId ?? '')
    setTags(initial?.labels ?? [])
    setTagInput('')
    setSubtasks(initial?.subtasks ?? [])
    setSubtaskInput('')
    setAttachments(initial?.attachments ?? [])
  }, [initial, defaultProjectId])

  function handleOpenChange(v: boolean) {
    if (!v) resetForm()
    onOpenChange(v)
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t])
    setTagInput('')
  }
  function removeTag(t: string) { setTags((prev) => prev.filter((x) => x !== t)) }
  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
    if (e.key === 'Backspace' && !tagInput) setTags((prev) => prev.slice(0, -1))
  }

  function addSubtask() {
    const t = subtaskInput.trim()
    if (!t) return
    setSubtasks((prev) => [...prev, { id: crypto.randomUUID(), title: t, done: false }])
    setSubtaskInput('')
  }
  function toggleSubtask(id: string) {
    setSubtasks((prev) => prev.map((s) => s.id === id ? { ...s, done: !s.done } : s))
  }
  function removeSubtask(id: string) {
    setSubtasks((prev) => prev.filter((s) => s.id !== id))
  }

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
      setAttachments((prev) => [...prev, { name: file.name, url: urlData.publicUrl, type: file.type }])
      toast.success('File attached')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!taskTitle.trim()) return
    setSaving(true)
    await onSubmit({
      title: taskTitle.trim(),
      description: description.trim() || null,
      priority,
      status: initial?.status ?? 'todo',
      due_date: dueDate || null,
      due_time: dueTime || null,
      recurrence: repeat === 'none' ? null : repeat,
      reminder: reminderAt ? new Date(reminderAt).toISOString() : null,
      estimated_time: estimatedMinutes ? parseInt(estimatedMinutes, 10) : null,
      project_id: projectId || null,
      labels: tags,
      subtasks,
      attachments,
    })
    setSaving(false)
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 py-2">

            {/* ── Core ─────────────────────────────────────────── */}
            <div className="space-y-1.5">
              <Label htmlFor="task-title">Task *</Label>
              <Input
                id="task-title"
                placeholder="What needs to be done?"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Notes</Label>
              <Textarea
                id="description"
                placeholder="Add details…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <Label>
                <Flag className="w-3.5 h-3.5 inline mr-1" />
                Priority
              </Label>
              <Select value={priority} onValueChange={(v) => v && setPriority(v as Task['priority'])}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      <span className="flex items-center gap-2">
                        <span className={cn('w-2 h-2 rounded-full shrink-0', p.dot)} />
                        {p.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ── Schedule ─────────────────────────────────────── */}
            <div className="border-t border-border/50 pt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="due-date">
                    <CalendarDays className="w-3.5 h-3.5 inline mr-1" />
                    Due Date
                  </Label>
                  <Input
                    id="due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="due-time">
                    <Clock className="w-3.5 h-3.5 inline mr-1" />
                    Due Time
                  </Label>
                  <Input
                    id="due-time"
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>
                  <Repeat2 className="w-3.5 h-3.5 inline mr-1" />
                  Repeat
                </Label>
                <Select value={repeat} onValueChange={(v) => v !== null && setRepeat(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No repeat</SelectItem>
                    <SelectItem value="FREQ=DAILY">Daily</SelectItem>
                    <SelectItem value="FREQ=WEEKLY">Weekly</SelectItem>
                    <SelectItem value="FREQ=MONTHLY">Monthly</SelectItem>
                    <SelectItem value="FREQ=YEARLY">Yearly</SelectItem>
                    <SelectItem value="FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR">Weekdays</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="reminder">
                    <Bell className="w-3.5 h-3.5 inline mr-1" />
                    Reminder
                  </Label>
                  <Input
                    id="reminder"
                    type="datetime-local"
                    value={reminderAt}
                    onChange={(e) => setReminderAt(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="estimated">
                    <Clock className="w-3.5 h-3.5 inline mr-1" />
                    Duration (min)
                  </Label>
                  <Input
                    id="estimated"
                    type="number"
                    min="1"
                    placeholder="e.g. 30"
                    value={estimatedMinutes}
                    onChange={(e) => setEstimatedMinutes(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ── Organize ─────────────────────────────────────── */}
            <div className="border-t border-border/50 pt-3 space-y-3">
              {projects.length > 0 && (
                <div className="space-y-1.5">
                  <Label>
                    <Tag className="w-3.5 h-3.5 inline mr-1" />
                    Project
                  </Label>
                  <Select
                    value={projectId || 'none'}
                    onValueChange={(v) => v !== null && setProjectId(v === 'none' ? '' : v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="No project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: p.color }}
                            />
                            {p.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-1.5 p-2 border rounded-lg min-h-[2.25rem] focus-within:ring-1 focus-within:ring-ring">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="gap-1 text-xs cursor-pointer"
                      onClick={() => removeTag(tag)}
                    >
                      #{tag}
                      <X className="w-2.5 h-2.5" />
                    </Badge>
                  ))}
                  <input
                    className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    placeholder={tags.length === 0 ? 'Add tags…' : ''}
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    onBlur={addTag}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Press Enter or comma to add</p>
              </div>
            </div>

            {/* ── Subtasks ─────────────────────────────────────── */}
            <div className="border-t border-border/50 pt-3 space-y-2">
              <Label>Subtasks</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a subtask…"
                  value={subtaskInput}
                  onChange={(e) => setSubtaskInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask() } }}
                  className="flex-1"
                />
                <Button type="button" size="sm" variant="outline" onClick={addSubtask} aria-label="Add subtask">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {subtasks.length > 0 && (
                <div className="space-y-0.5">
                  {subtasks.map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center gap-2 py-1 px-2 rounded-md hover:bg-muted/50 group"
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
                      <span className={cn('flex-1 text-sm', sub.done && 'line-through text-muted-foreground')}>
                        {sub.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSubtask(sub.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground text-right">
                    {subtasks.filter((s) => s.done).length}/{subtasks.length} done
                  </p>
                </div>
              )}
            </div>

            {/* ── Attachments ──────────────────────────────────── */}
            <div className="border-t border-border/50 pt-3 space-y-2">
              <Label>
                <Paperclip className="w-3.5 h-3.5 inline mr-1" />
                Attachments
              </Label>
              <label className="flex items-center gap-2 px-3 py-2 border border-dashed rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground">
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
                        aria-label="Remove attachment"
                        onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
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

          <DialogFooter className="gap-2 shrink-0 pt-2 border-t">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : initial ? 'Update Task' : 'Add Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
