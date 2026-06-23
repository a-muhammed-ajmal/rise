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

// Today as YYYY-MM-DD (Supabase/PostgreSQL date format)
export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

// Convert YYYY-MM-DD → Date object
export function parseDate(dateStr: string): Date {
  return parseISO(dateStr)
}
