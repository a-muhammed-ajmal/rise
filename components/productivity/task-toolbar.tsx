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
import { PRIORITY_MAP, PRIORITY_CONFIG } from './task-constants'
import type { Task } from '@/lib/types/database'

interface TaskToolbarProps {
  selectedCount: number
  totalCount: number
  onSelectAll: () => void
  onComplete: () => void
  onDelete: () => void
  onSetPriority: (priority: Task['priority']) => void
  onClearSelection: () => void
}

export function TaskToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onComplete,
  onDelete,
  onSetPriority,
  onClearSelection,
}: TaskToolbarProps) {
  if (selectedCount === 0) return null

  const allSelected = selectedCount === totalCount

  return (
    <div className={cn(
      'fixed bottom-[88px] left-1/2 -translate-x-1/2 z-50',
      'flex items-center gap-1 px-3 py-2 rounded-2xl',
      'bg-card border border-border shadow-popup',
      'animate-in slide-in-from-bottom-4 duration-200',
      'max-w-[calc(100vw-2rem)]'
    )}>
      {/* Count + select all */}
      <div className="flex items-center gap-1.5 pr-1">
        <span className="text-xs font-semibold text-foreground tabular-nums whitespace-nowrap">
          {selectedCount} selected
        </span>
        {!allSelected && (
          <button
            type="button"
            onClick={onSelectAll}
            className="text-xs text-[var(--brand-text)] hover:underline whitespace-nowrap"
          >
            All ({totalCount})
          </button>
        )}
      </div>

      <div className="w-px h-4 bg-border shrink-0" />

      {/* Complete */}
      <Button size="sm" variant="ghost" className="gap-1 text-xs h-8 px-2" onClick={onComplete}>
        <Check className="w-3.5 h-3.5 text-[var(--color-success)]" aria-hidden="true" />
        <span className="hidden md:inline">Done</span>
      </Button>

      {/* Priority */}
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center gap-1 h-8 px-2 text-xs rounded-md hover:bg-accent transition-colors font-medium text-foreground">
          <span className="hidden md:inline">Priority</span>
          <ChevronDown className="w-3 h-3" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" side="top">
          {PRIORITY_MAP.map((p) => (
            <DropdownMenuItem key={p.value} onClick={() => onSetPriority(p.value)} className="text-xs gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PRIORITY_CONFIG[p.value].color }} />
              {p.value} — {p.value === 'P1' ? 'Urgent' : p.value === 'P2' ? 'High' : p.value === 'P3' ? 'Medium' : 'Low'}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete */}
      <Button size="sm" variant="ghost" className="gap-1 text-xs h-8 px-2 text-destructive hover:text-destructive" onClick={onDelete}>
        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="hidden md:inline">Delete</span>
      </Button>

      <div className="w-px h-4 bg-border shrink-0" />

      {/* Clear */}
      <button
        type="button"
        onClick={onClearSelection}
        className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
        aria-label="Clear selection"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
