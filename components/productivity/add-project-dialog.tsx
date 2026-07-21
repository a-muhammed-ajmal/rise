'use client'

import { useState, useEffect } from 'react'
import { Pencil } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { PROJECT_COLORS, PROJECT_CATEGORIES } from './task-constants'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { ProjectCategory } from '@/lib/types/database'

interface AddProjectDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  defaultCategory?: ProjectCategory
  onProjectCreate: (name: string, color: string, description: string | null, category: ProjectCategory) => Promise<void>
}

export function AddProjectDialog({ open, onOpenChange, defaultCategory = 'default', onProjectCreate }: AddProjectDialogProps) {
  const [projectName, setProjectName] = useState('')
  const [projectColor, setProjectColor] = useState(PROJECT_COLORS[0])
  const [projectDescription, setProjectDescription] = useState('')
  const [projectCategory, setProjectCategory] = useState<ProjectCategory>(defaultCategory)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setProjectName('')
      setProjectColor(PROJECT_COLORS[0])
      setProjectDescription('')
      setProjectCategory(defaultCategory)
      setSaving(false)
    }
  }, [open, defaultCategory])

  async function handleProjectCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!projectName.trim()) return
    setSaving(true)
    try {
      await onProjectCreate(
        projectName.trim(),
        projectColor,
        projectDescription.trim() || null,
        projectCategory,
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
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleProjectCreate} className="space-y-4 pt-1">
          <div className="space-y-2">
            <Label htmlFor="ap-name">Name *</Label>
            <Input
              id="ap-name"
              placeholder="Project name"
              icon={<Pencil aria-hidden="true" />}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={projectCategory} onValueChange={(v) => setProjectCategory(v as ProjectCategory)}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      {cat.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Label htmlFor="ap-desc">Description</Label>
            <Textarea
              id="ap-desc"
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
      </DialogContent>
    </Dialog>
  )
}
