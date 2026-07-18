// Recurrence engine for tasks — parses / formats a subset of iCal RRULE and
// computes the next due date for spawn-on-complete. Pure and dependency-light
// (date-fns only) so it is fully unit-testable.
//
// Supported rule grammar (semicolon-delimited RRULE parts):
//   FREQ=DAILY|WEEKLY|MONTHLY|YEARLY   (required)
//   INTERVAL=<n>                        (optional, default 1)
//   BYDAY=MO,TU,...                     (optional, only meaningful for WEEKLY)
//   UNTIL=YYYYMMDD                       (optional, inclusive end date)
//   COUNT=<n>                            (optional, remaining occurrences)
//
// Examples:
//   Daily          → "FREQ=DAILY"
//   Weekdays       → "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR"
//   Bi-weekly M/W  → "FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE"
//   Monthly, 6×    → "FREQ=MONTHLY;COUNT=6"

import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  parseISO,
  format,
  isAfter,
  startOfWeek,
  differenceInCalendarWeeks,
  getDay,
} from 'date-fns'

export type Weekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU'
export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

export interface RecurrenceSpec {
  freq: Frequency
  /** How many freq-units between occurrences (≥ 1). */
  interval: number
  /** WEEKLY only: which weekdays. Empty means "same weekday as the start date". */
  byday: Weekday[]
  /** Inclusive end date 'YYYY-MM-DD', or null for no end. */
  until: string | null
  /** Remaining occurrence count, or null for unbounded. */
  count: number | null
}

/** Monday-first weekday order (matches the app's calendars). */
export const WEEKDAYS: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

const WEEKDAY_LABEL: Record<Weekday, string> = {
  MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun',
}

// getDay(): 0=Sun … 6=Sat
const DOW_TO_WEEKDAY: Weekday[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/** The Weekday of a 'YYYY-MM-DD' date. */
export function weekdayOf(dateISO: string): Weekday {
  return DOW_TO_WEEKDAY[getDay(parseISO(dateISO))]
}

// ─── Parse / format ──────────────────────────────────────────────────────────

const FREQS: Frequency[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']

/** Parse an RRULE string into a spec, or null if absent/invalid. */
export function parseRule(rule: string | null | undefined): RecurrenceSpec | null {
  if (!rule) return null
  const parts = new Map<string, string>()
  for (const seg of rule.split(';')) {
    const [k, v] = seg.split('=')
    if (k && v) parts.set(k.trim().toUpperCase(), v.trim())
  }
  const freqRaw = parts.get('FREQ')?.toUpperCase()
  if (!freqRaw || !FREQS.includes(freqRaw as Frequency)) return null

  const intervalRaw = parseInt(parts.get('INTERVAL') ?? '1', 10)
  const interval = Number.isFinite(intervalRaw) && intervalRaw >= 1 ? intervalRaw : 1

  const byday = (parts.get('BYDAY') ?? '')
    .split(',')
    .map((d) => d.trim().toUpperCase())
    .filter((d): d is Weekday => (WEEKDAYS as string[]).includes(d))

  const untilRaw = parts.get('UNTIL')
  const until = untilRaw && /^\d{8}/.test(untilRaw)
    ? `${untilRaw.slice(0, 4)}-${untilRaw.slice(4, 6)}-${untilRaw.slice(6, 8)}`
    : null

  const countRaw = parts.get('COUNT')
  const countNum = countRaw ? parseInt(countRaw, 10) : NaN
  const count = Number.isFinite(countNum) && countNum >= 1 ? countNum : null

  return { freq: freqRaw as Frequency, interval, byday, until, count }
}

/** Serialize a spec back to an RRULE string. */
export function formatRule(spec: RecurrenceSpec): string {
  const parts = [`FREQ=${spec.freq}`]
  if (spec.interval > 1) parts.push(`INTERVAL=${spec.interval}`)
  if (spec.freq === 'WEEKLY' && spec.byday.length > 0) {
    // Emit in canonical Monday-first order.
    const ordered = WEEKDAYS.filter((d) => spec.byday.includes(d))
    parts.push(`BYDAY=${ordered.join(',')}`)
  }
  if (spec.until) parts.push(`UNTIL=${spec.until.replace(/-/g, '')}`)
  if (spec.count != null) parts.push(`COUNT=${spec.count}`)
  return parts.join(';')
}

// ─── Human description ───────────────────────────────────────────────────────

const WEEKDAY_SET = new Set(['MO', 'TU', 'WE', 'TH', 'FR'])

/** Short human label, e.g. "Every 2 weeks on Mon, Wed · ends after 5". */
export function describeRecurrence(rule: string | null | undefined): string {
  const spec = parseRule(rule)
  if (!spec) return 'None'

  let base: string
  if (spec.freq === 'WEEKLY' && spec.byday.length === 5 && spec.byday.every((d) => WEEKDAY_SET.has(d))) {
    base = 'Weekdays'
  } else if (spec.interval === 1) {
    base = { DAILY: 'Daily', WEEKLY: 'Weekly', MONTHLY: 'Monthly', YEARLY: 'Yearly' }[spec.freq]
  } else {
    const unit = { DAILY: 'days', WEEKLY: 'weeks', MONTHLY: 'months', YEARLY: 'years' }[spec.freq]
    base = `Every ${spec.interval} ${unit}`
  }

  if (spec.freq === 'WEEKLY' && spec.byday.length > 0 && base !== 'Weekdays') {
    const days = WEEKDAYS.filter((d) => spec.byday.includes(d)).map((d) => WEEKDAY_LABEL[d])
    base += ` on ${days.join(', ')}`
  }

  if (spec.count != null) base += ` · ends after ${spec.count}`
  else if (spec.until) base += ` · until ${spec.until}`
  return base
}

// ─── Next occurrence ─────────────────────────────────────────────────────────

function nextWeeklyByday(from: Date, interval: number, byday: Weekday[]): Date {
  const fromWeekStart = startOfWeek(from, { weekStartsOn: 1 })
  const set = new Set(byday)
  for (let i = 1; i <= 7 * (interval + 1); i++) {
    const cand = addDays(from, i)
    if (!set.has(DOW_TO_WEEKDAY[getDay(cand)])) continue
    const weeksApart = differenceInCalendarWeeks(
      startOfWeek(cand, { weekStartsOn: 1 }),
      fromWeekStart,
      { weekStartsOn: 1 }
    )
    if (weeksApart % interval === 0) return cand
  }
  return addWeeks(from, interval)
}

/**
 * The next due date strictly after `fromISO` ('YYYY-MM-DD'), honoring FREQ,
 * INTERVAL, BYDAY and UNTIL. Returns 'YYYY-MM-DD', or null if the rule has no
 * further occurrence (past UNTIL, or not recurring).
 *
 * COUNT is NOT applied here — the caller decrements it via {@link decrementCount}
 * as instances are spawned.
 */
export function nextDueDate(rule: string | null | undefined, fromISO: string): string | null {
  const spec = parseRule(rule)
  if (!spec) return null
  const from = parseISO(fromISO)

  let next: Date
  switch (spec.freq) {
    case 'DAILY':
      next = addDays(from, spec.interval)
      break
    case 'WEEKLY':
      next = spec.byday.length > 0
        ? nextWeeklyByday(from, spec.interval, spec.byday)
        : addWeeks(from, spec.interval)
      break
    case 'MONTHLY':
      next = addMonths(from, spec.interval)
      break
    case 'YEARLY':
      next = addYears(from, spec.interval)
      break
  }

  if (spec.until && isAfter(next, parseISO(spec.until))) return null
  return format(next, 'yyyy-MM-dd')
}

/**
 * Returns the rule with COUNT decremented by one, or null if that would exhaust
 * it (COUNT was 1). Rules without a COUNT are returned unchanged.
 */
export function decrementCount(rule: string | null | undefined): string | null {
  const spec = parseRule(rule)
  if (!spec) return null
  if (spec.count == null) return formatRule(spec)
  if (spec.count <= 1) return null
  return formatRule({ ...spec, count: spec.count - 1 })
}
