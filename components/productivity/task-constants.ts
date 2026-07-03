import type { Task } from '@/lib/types/database'

export const PRIORITY_MAP: Array<{
  value: Task['priority']
  label: string
  color: string
  description: string
}> = [
  { value: 'urgent', label: 'P1', color: 'bg-[var(--color-danger)] text-white',   description: 'Critical / must do now' },
  { value: 'high',   label: 'P2', color: 'bg-[var(--color-warning)] text-white',  description: 'High importance' },
  { value: 'medium', label: 'P3', color: 'bg-[var(--color-info)] text-white',     description: 'Normal priority' },
  { value: 'low',    label: 'P4', color: 'bg-[var(--text-muted)] text-white',     description: 'Low / someday' },
]

export const PRIORITY_LABEL: Record<Task['priority'], string> = {
  urgent: 'P1', high: 'P2', medium: 'P3', low: 'P4',
}

export const PRIORITY_PILL: Record<Task['priority'], string> = {
  urgent: 'badge-urgent',
  high:   'badge-high',
  medium: 'badge-medium',
  low:    'badge-low',
}

export const PRIORITY_DOT: Record<Task['priority'], string> = {
  urgent: 'priority-dot-urgent',
  high:   'priority-dot-high',
  medium: 'priority-dot-medium',
  low:    'priority-dot-low',
}

export const STATUS_CONFIG: Array<{
  value: Task['status']
  label: string
  dotColor: string
}> = [
  { value: 'inbox',       label: 'Inbox',       dotColor: 'text-muted-foreground' },
  { value: 'todo',        label: 'To Do',        dotColor: 'text-[var(--color-info)]' },
  { value: 'in_progress', label: 'In Progress',  dotColor: 'text-[var(--color-warning)]' },
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
