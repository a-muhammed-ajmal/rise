import { format, parseISO, isToday, isYesterday, isTomorrow } from 'date-fns'

// AED currency — per spec, all amounts in UAE Dirham
export function formatAED(amount: number): string {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// DD/MM/YYYY — per spec date format
export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'dd/MM/yyyy')
}

// 12-hour time — per spec time format
export function formatTime(dateStr: string): string {
  return format(parseISO(dateStr), 'hh:mm a')
}

export function formatDateTime(dateStr: string): string {
  return format(parseISO(dateStr), 'dd/MM/yyyy hh:mm a')
}

// Human-friendly relative date labels
export function formatRelativeDate(dateStr: string): string {
  const date = parseISO(dateStr)
  if (isToday(date)) return 'Today'
  if (isYesterday(date)) return 'Yesterday'
  if (isTomorrow(date)) return 'Tomorrow'
  return format(date, 'dd/MM/yyyy')
}

// Today as YYYY-MM-DD in Asia/Dubai timezone (UTC+4, no DST)
export function todayISO(): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const y = parts.find(p => p.type === 'year')!.value
  const m = parts.find(p => p.type === 'month')!.value
  const d = parts.find(p => p.type === 'day')!.value
  return `${y}-${m}-${d}`
}

// Day of week (0=Sun…6=Sat) in Asia/Dubai timezone
export function todayDOW(): number {
  const [y, mo, d] = todayISO().split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, d)).getUTCDay()
}

// Current hour (0–23) in Asia/Dubai timezone
export function currentHourDubai(): number {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Dubai',
    hour: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date())
  return parseInt(parts.find(p => p.type === 'hour')!.value, 10)
}

// Convert YYYY-MM-DD → Date object
export function parseDate(dateStr: string): Date {
  return parseISO(dateStr)
}

// True when a task's due moment has passed (Asia/Dubai, UTC+4, no DST).
// With a due_time, compares against the exact deadline instant.
// Date-only: past only once the due day has fully ended (i.e. due_date is before today).
export function isPastDeadline(dueDate: string, dueTime?: string | null): boolean {
  if (dueTime) {
    return Date.now() > new Date(`${dueDate}T${dueTime}:00+04:00`).getTime()
  }
  return dueDate < todayISO()
}

// Convert HH:MM (24h stored format) → "h:mm AM/PM" display
export function display12h(time: string): string {
  const [hStr, mStr] = time.split(':')
  const h24 = parseInt(hStr, 10)
  const m = parseInt(mStr, 10)
  const ampm = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}
