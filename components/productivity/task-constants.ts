import type { Task } from '@/lib/types/database'

export const PRIORITY_MAP: Array<{
  value: Task['priority']
  label: string
  color: string
  description: string
}> = [
  { value: 'P1', label: 'P1', color: 'bg-[var(--color-danger)] text-white',   description: 'Urgent — must do now' },
  { value: 'P2', label: 'P2', color: 'bg-[var(--color-warning)] text-white',  description: 'High importance' },
  { value: 'P3', label: 'P3', color: 'bg-[var(--color-info)] text-white',     description: 'Medium — normal priority' },
  { value: 'P4', label: 'P4', color: 'bg-[var(--text-muted)] text-white',     description: 'Low / someday' },
]

export const PRIORITY_PILL: Record<Task['priority'], string> = {
  P1: 'badge-urgent',
  P2: 'badge-high',
  P3: 'badge-medium',
  P4: 'badge-low',
}

export const PRIORITY_DOT: Record<Task['priority'], string> = {
  P1: 'priority-dot-urgent',
  P2: 'priority-dot-high',
  P3: 'priority-dot-medium',
  P4: 'priority-dot-low',
}

export const STATUS_CONFIG: Array<{
  value: Task['status']
  label: string
  dotColor: string
}> = [
  { value: 'todo',        label: 'To Do',       dotColor: 'text-muted-foreground' },
  { value: 'in_progress', label: 'In Progress',  dotColor: 'text-[var(--color-warning)]' },
  { value: 'blocked',     label: 'Blocked',      dotColor: 'text-[var(--color-danger)]' },
  { value: 'on_hold',     label: 'On Hold',      dotColor: 'text-muted-foreground' },
  { value: 'done',        label: 'Done',         dotColor: 'text-[var(--color-success)]' },
]

export function repeatLabel(rule: string | null): string {
  if (!rule) return ''
  if (rule.includes('WEEKLY;BYDAY=MO')) return 'Weekdays'
  if (rule.includes('FREQ=DAILY'))   return 'Daily'
  if (rule.includes('FREQ=WEEKLY'))  return 'Weekly'
  if (rule.includes('FREQ=MONTHLY')) return 'Monthly'
  if (rule.includes('FREQ=YEARLY'))  return 'Yearly'
  return 'Recurring'
}
