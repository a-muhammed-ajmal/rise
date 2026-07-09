import type { Task } from '@/lib/types/database'

export const PRIORITY_MAP: Array<{ value: Task['priority'] }> = [
  { value: 'P1' },
  { value: 'P2' },
  { value: 'P3' },
  { value: 'P4' },
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

export const PRIORITY_CONFIG: Record<Task['priority'], { label: string; color: string; bgColor: string; textClass: string }> = {
  P1: { label: 'P1', color: '#EF4444', bgColor: '#FEF2F2', textClass: 'text-[var(--color-p1)]' },
  P2: { label: 'P2', color: '#FF6535', bgColor: '#FFF0EB', textClass: 'text-[var(--color-p2)]' },
  P3: { label: 'P3', color: '#3B82F6', bgColor: '#EFF6FF', textClass: 'text-[var(--color-p3)]' },
  P4: { label: 'P4', color: '#9CA3AF', bgColor: '#F9FAFB', textClass: 'text-[var(--color-p4)]' },
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

export const PROJECT_COLORS = [
  '#6366f1', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#8b5cf6', '#06b6d4', '#f43f5e',
]

// Pre-declared so Tailwind includes these classes in the build
export const PROJECT_COLOR_CLASS: Record<string, string> = {
  '#6366f1': 'bg-[#6366f1]',
  '#3b82f6': 'bg-[#3b82f6]',
  '#10b981': 'bg-[#10b981]',
  '#f59e0b': 'bg-[#f59e0b]',
  '#ef4444': 'bg-[#ef4444]',
  '#8b5cf6': 'bg-[#8b5cf6]',
  '#06b6d4': 'bg-[#06b6d4]',
  '#f43f5e': 'bg-[#f43f5e]',
}

// Pre-declared so Tailwind includes these arbitrary classes in the build
const LABEL_CLASSES = [
  'bg-[#EFF6FF] text-[#3B82F6]',
  'bg-[#F0FDF4] text-[#10B981]',
  'bg-[#FFF7ED] text-[#F97316]',
  'bg-[#FDF4FF] text-[#A855F7]',
  'bg-[#FFF1F2] text-[#F43F5E]',
  'bg-[#FFFBEB] text-[#F59E0B]',
]

export function getLabelColor(label: string): string {
  const idx =
    label.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) %
    LABEL_CLASSES.length
  return LABEL_CLASSES[idx]
}
