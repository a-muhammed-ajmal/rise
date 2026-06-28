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
  Tag,
  CalendarDays,
  Bell,
  LayoutList,
  Paperclip,
  Repeat2,
  Clock,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

// ─── Priority system: P1=urgent, P2=high, P3=medium, P4=low ─────────────────

const PRIORITY_MAP: Array<{ value: Task['priority']; label: string; color: string }> = [
  { value: 'urgent', label: 'P1', color: 'bg-red-500 text-white' },
  { value: 'high',   label: 'P2', color: 'bg-orange-500 text-white' },
  { value: 'medium', label: 'P3', color: 'bg-blue-500 text-white' },
  { value: 'low',    label: 'P4', color: 'bg-slate-400 text-white' },
]

type TabId = 'details' | 'schedule' | 'organize' | 'subtasks' | 'attachments'

const TABS: { id: TabId; icon: React.ReactNode; label: string }[] = [
  { id: 'details',     icon: <LayoutList className="w-3.5 h-3.5" />,  label: 'Details' },
  { id: 'schedule',    icon: <CalendarDays className="w-3.5 h-3.5" />, label: 'Schedule' },
  { id: 'organize',    icon: <Tag className="w-3.5 h-3.5" />,          label: 'Organize' },
  { id: 'subtasks',    icon: <Check className="w-3.5 h-3.5" />,        label: 'Subtasks' },
  { id: 'attachments', icon: <Paperclip className="w-3.5 h-3.5" />,    label: 'Files' },
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
  const [activeTab, setActiveTab] = useState<TabId>('details')

  // ── Details
  const [taskTitle, setTaskTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [priority, setPriority] = useState<Task['priority']>(initial?.priority ?? 'medium')
  const [status, setStatus] = useState<Task['status']>(initial?.status ?? 'inbox')

  // ── Schedule
  const [dueDate, setDueDate] = useState(initial?.due_date ?? '')
  const [dueTime, setDueTime] = useState(initial?.due_time ?? '')
  const [repeat, setRepeat] = useState(initial?.recurrence_rule ?? 'none')
  const [reminderAt, setReminderAt] = useState(
    initial?.reminder_at ? initial.reminder_at.slice(0, 16) : ''
  )
  const [estimatedMinutes, setEstimatedMinutes] = useState(
    initial?.estimated_minutes?.toString() ?? ''
  )

  // ── Organize
  const [projectId, setProjectId] = useState(
    initial?.project_id ?? defaultProjectId ?? ''
  )
  const [tags, setTags] = useState<string[]>(initial?.tags ?? [])
  const [tagInput, setTagInput] = useState('')

  // ── Subtasks
  const [subtasks, setSubtasks] = useState<Subtask[]>(initial?.subtasks ?? [])
  const [subtaskInput, setSubtaskInput] = useState('')

  // ── Attachments
  const [attachments, setAttachments] = useState<TaskAttachment[]>(initial?.attachments ?? [])
  const [uploading, setUploading] = useState(false)

  const [saving, setSaving] = useState(false)

  // ── Reset when dialog closes/opens
  const resetForm = useCallback(() => {
    setActiveTab('details')
    setTaskTitle(initial?.title ?? '')
    setDescription(initial?.description ?? '')
    setPriority(initial?.priority ?? 'medium')
    setStatus(initial?.status ?? 'inbox')
    setDueDate(initial?.due_date ?? '')
    setDueTime(initial?.due_time ?? '')
    setRepeat(initial?.recurrence_rule ?? 'none')
    setReminderAt(initial?.reminder_at ? initial.reminder_at.slice(0, 16) : '')
    setEstimatedMinutes(initial?.estimated_minutes?.toString() ?? '')
    setProjectId(initial?.project_id ?? defaultProjectId ?? '')
    setTags(initial?.tags ?? [])
    setTagInput('')
    setSubtasks(initial?.subtasks ?? [])
    setSubtaskInput('')
    setAttachments(initial?.attachments ?? [])
  }, [initial, defaultProjectId])

  function handleOpenChange(v: boolean) {
    if (!v) resetForm()
    onOpenChange(v)
  }

  // ── Tag helpers
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

  // ── Subtask helpers
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

  // ── File upload
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
    if (!taskTitle.trim()) { setActiveTab('details'); return }
    setSaving(true)
    await onSubmit({
      title: taskTitle.trim(),
      description: description.trim() || null,
      priority,
      status,
      due_date: dueDate || null,
      due_time: dueTime || null,
      recurrence_rule: repeat === 'none' ? null : repeat,
      is_recurring: repeat !== 'none',
      reminder_at: reminderAt ? new Date(reminderAt).toISOString() : null,
      estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes, 10) : null,
      project_id: projectId || null,
      tags,
      subtasks,
      attachments,
    })
    setSaving(false)
    handleOpenChange(false)
  }

  const priorityInfo = PRIORITY_MAP.find((p) => p.value === priority)!

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {/* Tab strip */}
        <div className="flex gap-0.5 p-1 bg-muted rounded-lg shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto pr-1 space-y-4 py-2">

            {/* ── DETAILS TAB ───────────────────────────────────── */}
            {activeTab === 'details' && (
              <>
                <div className="space-y-2">
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

                <div className="space-y-2">
                  <Label htmlFor="description">Notes</Label>
                  <Textarea
                    id="description"
                    placeholder="Add details…"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Priority — P1/P2/P3/P4 pills */}
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <div className="flex gap-2">
                    {PRIORITY_MAP.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setPriority(p.value)}
                        className={cn(
                          'flex-1 py-2 rounded-lg text-xs font-semibold transition-all',
                          priority === p.value
                            ? p.color + ' scale-105 ring-2 ring-offset-2 ring-current'
                            : 'bg-muted text-muted-foreground hover:bg-muted/70'
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {priorityInfo.label} — {
                      priority === 'urgent' ? 'Critical / must do now' :
                      priority === 'high'   ? 'High importance' :
                      priority === 'medium' ? 'Normal priority' :
                                              'Low priority / someday'
                    }
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => v && setStatus(v as Task['status'])}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inbox">Inbox</SelectItem>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* ── SCHEDULE TAB ─────────────────────────────────── */}
            {activeTab === 'schedule' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
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
                  <div className="space-y-2">
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

                <div className="space-y-2">
                  <Label>
                    <Repeat2 className="w-3.5 h-3.5 inline mr-1" />
                    Repeat
                  </Label>
                  <Select value={repeat} onValueChange={(v) => v !== null && setRepeat(v)}>
                    <SelectTrigger>
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

                <div className="space-y-2">
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

                <div className="space-y-2">
                  <Label htmlFor="estimated">
                    <Clock className="w-3.5 h-3.5 inline mr-1" />
                    Estimated Duration
                  </Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      id="estimated"
                      type="number"
                      min="1"
                      placeholder="e.g. 30"
                      value={estimatedMinutes}
                      onChange={(e) => setEstimatedMinutes(e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground shrink-0">minutes</span>
                  </div>
                  {estimatedMinutes && parseInt(estimatedMinutes) >= 60 && (
                    <p className="text-xs text-muted-foreground">
                      ≈ {Math.floor(parseInt(estimatedMinutes) / 60)}h {parseInt(estimatedMinutes) % 60}m
                    </p>
                  )}
                </div>
              </>
            )}

            {/* ── ORGANIZE TAB ─────────────────────────────────── */}
            {activeTab === 'organize' && (
              <>
                {projects.length > 0 && (
                  <div className="space-y-2">
                    <Label>Project</Label>
                    <Select
                      value={projectId || 'none'}
                      onValueChange={(v) => v !== null && setProjectId(v === 'none' ? '' : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No project</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            <span className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full inline-block"
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

                <div className="space-y-2">
                  <Label>Tags / Labels</Label>
                  <div className="flex flex-wrap gap-1.5 p-2 border rounded-md min-h-[2.5rem] focus-within:ring-1 focus-within:ring-ring">
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
                  <p className="text-xs text-muted-foreground">Press Enter or comma to add a tag</p>
                </div>

                {/* Priority summary */}
                <div className="space-y-2">
                  <Label>Current Priority</Label>
                  <div className="flex gap-2">
                    {PRIORITY_MAP.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setPriority(p.value)}
                        className={cn(
                          'flex-1 py-1.5 rounded-md text-xs font-semibold transition-all',
                          priority === p.value
                            ? p.color + ' ring-2 ring-offset-1 ring-current'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── SUBTASKS TAB ─────────────────────────────────── */}
            {activeTab === 'subtasks' && (
              <>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add a subtask…"
                    value={subtaskInput}
                    onChange={(e) => setSubtaskInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask() } }}
                    className="flex-1"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={addSubtask}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>

                {subtasks.length === 0 ? (
                  <p className="text-sm text-center text-muted-foreground py-6">
                    No subtasks yet. Add one above.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {subtasks.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 group"
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
                      {subtasks.filter((s) => s.done).length}/{subtasks.length} completed
                    </p>
                  </div>
                )}
              </>
            )}

            {/* ── ATTACHMENTS TAB ──────────────────────────────── */}
            {activeTab === 'attachments' && (
              <>
                <label className="flex flex-col items-center gap-2 p-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                  <Paperclip className="w-6 h-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {uploading ? 'Uploading…' : 'Click to attach a file'}
                  </span>
                  <input
                    type="file"
                    className="sr-only"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>

                {attachments.length === 0 ? (
                  <p className="text-xs text-center text-muted-foreground">No files attached.</p>
                ) : (
                  <div className="space-y-1.5">
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
                          onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
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
