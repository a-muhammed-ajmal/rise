'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ArrowRight, FolderPlus, ListPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PRIORITY_MAP, PROJECT_COLORS, STATUS_CONFIG } from './task-constants'
import { toast } from 'sonner'
import type { Task } from '@/lib/types/database'

interface UnifiedAddDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  initialTab?: 'task' | 'project'
  projects: Array<{ id: string; name: string; color: string }>
  defaultProjectId?: string | null
  onTaskCreate: (data: Partial<Task>) => Promise<void>
  onOpenFull: (partial: Partial<Task>) => void
  onProjectCreate: (name: string, color: string, description: string | null) => Promise<void>
}

export function UnifiedAddDialog({
  open,
  onOpenChange,
  initialTab = 'task',
  projects,
  defaultProjectId,
  onTaskCreate,
  onOpenFull,
  onProjectCreate,
}: UnifiedAddDialogProps) {
  const [activeTab, setActiveTab] = useState<'task' | 'project'>(initialTab)

  // Task quick-add state
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState<Task['priority']>('P3')
  const [taskStatus, setTaskStatus] = useState<Task['status']>('todo')
  const [dueDate, setDueDate] = useState('')
  const [projectId, setProjectId] = useState(defaultProjectId ?? '')
  const [labels, setLabels] = useState('')

  // Project state
  const [projectName, setProjectName] = useState('')
  const [projectColor, setProjectColor] = useState(PROJECT_COLORS[0])
  const [projectDescription, setProjectDescription] = useState('')

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab)
      setTitle('')
      setPriority('P3')
      setTaskStatus('todo')
      setDueDate('')
      setProjectId(defaultProjectId ?? '')
      setLabels('')
      setProjectName('')
      setProjectColor(PROJECT_COLORS[0])
      setProjectDescription('')
      setSaving(false)
    }
  }, [open, initialTab, defaultProjectId])

  function parsedLabels(): string[] {
    return labels
      .split(',')
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean)
  }

  async function handleTaskCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      await onTaskCreate({
        title: title.trim(),
        priority,
        status: taskStatus,
        due_date: dueDate || null,
        project_id: projectId || null,
        labels: parsedLabels(),
      })
      onOpenChange(false)
    } catch {
      toast.error('Failed to add task')
      setSaving(false)
    }
  }

  function handleOpenFull() {
    onOpenFull({
      title: title.trim() || undefined,
      priority,
      status: taskStatus,
      due_date: dueDate || null,
      project_id: projectId || null,
      labels: parsedLabels(),
    })
    onOpenChange(false)
  }

  async function handleProjectCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!projectName.trim()) return
    setSaving(true)
    try {
      await onProjectCreate(
        projectName.trim(),
        projectColor,
        projectDescription.trim() || null,
      )
      onOpenChange(false)
    } catch {
      toast.error('Failed to create project')
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New</DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'task' | 'project')}
        >
          <TabsList className="w-full">
            <TabsTrigger value="task" className="flex-1 gap-1.5">
              <ListPlus className="w-3.5 h-3.5" aria-hidden="true" />
              Task
            </TabsTrigger>
            <TabsTrigger value="project" className="flex-1 gap-1.5">
              <FolderPlus className="w-3.5 h-3.5" aria-hidden="true" />
              Project
            </TabsTrigger>
          </TabsList>

          {/* ── Task tab ── */}
          <TabsContent value="task">
            <form onSubmit={handleTaskCreate} className="space-y-4 pt-3">
              <div className="space-y-2">
                <Label htmlFor="ua-title">Task *</Label>
                <Input
                  id="ua-title"
                  placeholder="What needs to be done?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  autoFocus
                  required
                />
              </div>

              {/* Priority pills */}
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
                          ? cn(p.color, 'ring-2 ring-offset-2 ring-current scale-105')
                          : 'bg-muted text-muted-foreground hover:bg-muted/70'
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status + Due Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={taskStatus}
                    onValueChange={(v) => v && setTaskStatus(v as Task['status'])}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_CONFIG.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ua-due">Due Date</Label>
                  <Input
                    id="ua-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              {/* Project */}
              {projects.length > 0 && (
                <div className="space-y-2">
                  <Label>Project</Label>
                  <Select
                    value={projectId || 'none'}
                    onValueChange={(v) => v !== null && setProjectId(v === 'none' ? '' : v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="No project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No project</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full shrink-0 inline-block"
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

              {/* Labels */}
              <div className="space-y-2">
                <Label htmlFor="ua-labels">Labels</Label>
                <Input
                  id="ua-labels"
                  placeholder="work, urgent, review"
                  value={labels}
                  onChange={(e) => setLabels(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Separate labels with commas
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-1 border-t border-border">
                <button
                  type="button"
                  onClick={handleOpenFull}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  More options
                  <ArrowRight className="w-3 h-3" aria-hidden="true" />
                </button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={saving || !title.trim()}
                  >
                    {saving ? 'Adding…' : 'Add Task'}
                  </Button>
                </div>
              </div>
            </form>
          </TabsContent>

          {/* ── Project tab ── */}
          <TabsContent value="project">
            <form onSubmit={handleProjectCreate} className="space-y-4 pt-3">
              <div className="space-y-2">
                <Label htmlFor="ua-pname">Name *</Label>
                <Input
                  id="ua-pname"
                  placeholder="Project name"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2 flex-wrap">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Color ${c}`}
                      onClick={() => setProjectColor(c)}
                      className={cn(
                        'w-7 h-7 rounded-full transition-transform',
                        projectColor === c
                          ? 'scale-125 ring-2 ring-offset-2 ring-current'
                          : 'hover:scale-110'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="ua-pdesc">Description</Label>
                <Textarea
                  id="ua-pdesc"
                  placeholder="Optional description…"
                  rows={2}
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-1 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={saving || !projectName.trim()}
                >
                  {saving ? 'Creating…' : 'Create Project'}
                </Button>
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
