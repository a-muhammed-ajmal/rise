'use client'

import { Check, Trash2, ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Task } from '@/lib/types/database'

const PRIORITY_MAP: Array<{ value: Task['priority']; label: string }> = [
  { value: 'urgent', label: 'P1 – Urgent' },
  { value: 'high',   label: 'P2 – High' },
  { value: 'medium', label: 'P3 – Medium' },
  { value: 'low',    label: 'P4 – Low' },
]

interface TaskToolbarProps {
  selectedCount: number
  onComplete: () => void
  onDelete: () => void
  onSetPriority: (priority: Task['priority']) => void
  onClearSelection: () => void
}

export function TaskToolbar({
  selectedCount,
  onComplete,
  onDelete,
  onSetPriority,
  onClearSelection,
}: TaskToolbarProps) {
  if (selectedCount === 0) return null

  return (
    <div className={cn(
      'fixed bottom-24 left-1/2 -translate-x-1/2 z-50',
      'flex items-center gap-2 px-4 py-2.5 rounded-2xl',
      'bg-card border border-border shadow-2xl shadow-black/20',
      'animate-in slide-in-from-bottom-4 duration-200'
    )}>
      {/* Count badge */}
      <span className="text-sm font-medium text-foreground min-w-[4rem] text-center">
        {selectedCount} selected
      </span>

      <div className="w-px h-5 bg-border" />

      {/* Complete */}
      <Button
        size="sm"
        variant="ghost"
        className="gap-1.5 text-xs h-8"
        onClick={onComplete}
      >
        <Check className="w-3.5 h-3.5 text-green-500" />
        Complete
      </Button>

      {/* Set Priority */}
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-1.5 h-8 px-2 text-xs rounded-md hover:bg-accent transition-colors font-medium text-foreground">
          Priority
          <ChevronDown className="w-3.5 h-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top">
          {PRIORITY_MAP.map((p) => (
            <DropdownMenuItem key={p.value} onClick={() => onSetPriority(p.value)}>
              {p.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete */}
      <Button
        size="sm"
        variant="ghost"
        className="gap-1.5 text-xs h-8 text-destructive hover:text-destructive"
        onClick={onDelete}
      >
        <Trash2 className="w-3.5 h-3.5" />
        Delete
      </Button>

      <div className="w-px h-5 bg-border" />

      {/* Clear */}
      <button
        type="button"
        onClick={onClearSelection}
        className="w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-label="Clear selection"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
