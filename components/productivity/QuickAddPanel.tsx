'use client'

import { useState, useEffect, useRef } from 'react'
import { X, CalendarDays, Plus, Loader2 } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DateTimePicker } from './DateTimePicker'
import { PRIORITY_MAP } from './task-constants'
import { formatRelativeDate, display12h } from '@/lib/format'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { Task } from '@/lib/types/database'

interface QuickAddPanelProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  onClose: () => void
  onOpenFull?: (taskId: string) => void
  defaultDate?: string
  defaultProjectId?: string
  defaultStatus?: Task['status']
  onAdd: (data: Partial<Task>) => Promise<string | null>
  projects: Array<{ id: string; name: string; color: string }>
}

export function QuickAddPanel({
  open,
  onOpenChange,
  onClose,
  onOpenFull,
  defaultDate,
  defaultProjectId,
  defaultStatus,
  onAdd,
  projects,
}: QuickAddPanelProps) {
  const [title, setTitle]           = useState('')
  const [priority, setPriority]     = useState<Task['priority']>('medium')
  const [projectId, setProjectId]   = useState(defaultProjectId ?? '')
  const [dueDate, setDueDate]       = useState(defaultDate ?? '')
  const [dueTime, setDueTime]       = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [saving, setSaving]         = useState(false)

  const titleRef = useRef<HTMLInputElement>(null)

  // Focus title on open; reset on close
  useEffect(() => {
    if (open) {
      setTimeout(() => titleRef.current?.focus(), 50)
    } else {
      setTitle('')
      setPriority('medium')
      setProjectId(defaultProjectId ?? '')
      setDueDate(defaultDate ?? '')
      setDueTime('')
      setShowDatePicker(false)
    }
  }, [open, defaultProjectId, defaultDate])

  async function handleSubmit() {
    const t = title.trim()
    if (!t) {
      titleRef.current?.focus()
      return
    }
    setSaving(true)
    try {
      const newId = await onAdd({
        title: t,
        priority,
        status: defaultStatus ?? 'inbox',
        project_id: projectId || null,
        due_date: dueDate || null,
        due_time: dueTime || null,
      })
      toast.success('Task added')
      onClose()
      if (onOpenFull && newId) {
        onOpenFull(newId)
      }
    } catch {
      toast.error('Failed to add task')
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      onOpenChange(false)
    }
  }

  const dueDateLabel = dueDate
    ? `${formatRelativeDate(dueDate)}${dueTime ? ` · ${display12h(dueTime)}` : ''}`
    : 'No date'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="rounded-t-2xl gap-0 pb-safe"
      >
        {/* Title row */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md hover:bg-accent transition-colors text-muted-foreground"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <input
            ref={titleRef}
            placeholder="Task title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-base font-medium outline-none placeholder:text-muted-foreground"
            autoComplete="off"
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2 px-4 py-3 flex-wrap">

          {/* Priority pills */}
          <div className="flex gap-1">
            {PRIORITY_MAP.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPriority(p.value)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-semibold transition-all',
                  priority === p.value
                    ? cn(p.color, 'scale-105')
                    : 'bg-muted text-muted-foreground hover:bg-accent'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Project dropdown */}
          <Select
            value={projectId || 'inbox'}
            onValueChange={(v) => setProjectId(!v || v === 'inbox' ? '' : v)}
          >
            <SelectTrigger className="h-7 text-xs gap-1.5 w-auto">
              <SelectValue placeholder="Inbox" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="inbox" className="text-xs">Inbox</SelectItem>
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

          {/* Due date trigger */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDatePicker((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs transition-colors',
                dueDate
                  ? 'border-primary/50 text-foreground'
                  : 'border-border text-muted-foreground hover:border-ring'
              )}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              {dueDateLabel}
            </button>

            {showDatePicker && (
              <div className="absolute bottom-full left-0 z-10 mb-1">
                <DateTimePicker
                  value={{ date: dueDate || undefined, time: dueTime || undefined }}
                  onChange={(v) => {
                    setDueDate(v.date ?? '')
                    setDueTime(v.time ?? '')
                  }}
                  onClose={() => setShowDatePicker(false)}
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-4 py-3 border-t gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || !title.trim()}
            className={cn(
              'flex items-center gap-1.5 h-8 px-4 rounded-lg text-sm font-medium transition-colors',
              'bg-mod-tasks text-white hover:bg-mod-tasks/90',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {saving
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Plus className="w-4 h-4" />
            }
            Add Task
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
