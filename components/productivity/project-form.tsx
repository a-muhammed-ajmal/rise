'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { PROJECT_COLORS } from './task-constants'
import { cn } from '@/lib/utils'
import type { Project } from '@/lib/types/database'

type ProjectStatus = Project['status']

interface ProjectFormProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  initial: Project | null
  onSaved: (name: string, color: string, description: string | null, status: ProjectStatus) => Promise<void>
}

export function ProjectForm({ open, onOpenChange, initial, onSaved }: ProjectFormProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(PROJECT_COLORS[0])
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<ProjectStatus>('active')
  const [saving, setSaving] = useState(false)

  const [lastInitialId, setLastInitialId] = useState<string | null>(null)
  if ((initial?.id ?? null) !== lastInitialId) {
    setLastInitialId(initial?.id ?? null)
    if (initial) {
      setName(initial.name)
      setColor(initial.color)
      setDescription(initial.description ?? '')
      setStatus(initial.status)
    } else {
      setName('')
      setColor(PROJECT_COLORS[0])
      setDescription('')
      setStatus('active')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    await onSaved(name.trim(), color, description.trim() || null, status)
    setSaving(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Project' : 'New Project'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pf-name">Name</Label>
            <Input
              id="pf-name"
              placeholder="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
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
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-7 h-7 rounded-full transition-transform',
                    color === c
                      ? 'scale-125 ring-2 ring-offset-2 ring-current'
                      : 'hover:scale-110'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pf-desc">Description</Label>
            <Textarea
              id="pf-desc"
              placeholder="Optional description…"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as ProjectStatus)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : initial ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
