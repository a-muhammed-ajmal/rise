// Pure task-form validation, mirroring the TaskFlow spec's "Field Validation
// Reference" (title 1–500; due_time/repeat require a due_date; est_time a
// positive integer ≤ 2880; ≤ 5 reminders; ≤ 10 labels). Kept UI-agnostic and
// side-effect-free so it is unit-testable and reusable by both the full form and
// Quick-Add.

export const TITLE_MAX = 500
export const EST_TIME_MAX = 2880 // minutes (48h)
export const REMINDERS_MAX = 5
export const LABELS_MAX = 10

export interface TaskDraft {
  title?: string | null
  due_date?: string | null
  due_time?: string | null
  recurrence?: string | null
  estimated_time?: number | null
  reminders?: unknown[] | null
  labels?: unknown[] | null
}

export interface ValidationResult {
  valid: boolean
  /** field name → human message; empty when valid. */
  errors: Record<string, string>
}

export function validateTask(d: TaskDraft): ValidationResult {
  const errors: Record<string, string> = {}

  const title = (d.title ?? '').trim()
  if (title.length === 0) {
    errors.title = 'Title is required.'
  } else if (title.length > TITLE_MAX) {
    errors.title = `Title must be ${TITLE_MAX} characters or fewer.`
  }

  const hasDueDate = Boolean(d.due_date)
  if (d.due_time && !hasDueDate) {
    errors.due_time = 'Set a due date before adding a time.'
  }
  if (d.recurrence && !hasDueDate) {
    errors.recurrence = 'Set a due date before adding a repeat.'
  }

  if (d.estimated_time != null) {
    const t = d.estimated_time
    if (!Number.isInteger(t) || t < 1) {
      errors.estimated_time = 'Estimated time must be a positive number of minutes.'
    } else if (t > EST_TIME_MAX) {
      errors.estimated_time = `Estimated time can be at most ${EST_TIME_MAX} minutes (48h).`
    }
  }

  if (Array.isArray(d.reminders) && d.reminders.length > REMINDERS_MAX) {
    errors.reminders = `A task can have at most ${REMINDERS_MAX} reminders.`
  }

  if (Array.isArray(d.labels) && d.labels.length > LABELS_MAX) {
    errors.labels = `A task can have at most ${LABELS_MAX} labels.`
  }

  return { valid: Object.keys(errors).length === 0, errors }
}
