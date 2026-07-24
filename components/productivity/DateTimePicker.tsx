'use client'

import { useMemo, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Clock, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DateTimePickerProps {
  initialDate?: Date
  hasInitialTime?: boolean
  onSave: (date: Date, hasTime: boolean) => void
  onCancel: () => void
  mode?: 'date' | 'time' | 'datetime'
  minDate?: Date
  maxDate?: Date
  disabledDates?: Date[]
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstWeekday(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

function normalizeDate(date: Date) {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

function isDateDisabled(date: Date, minDate?: Date, maxDate?: Date, disabledDates: Date[] = []) {
  const normalized = normalizeDate(date)
  if (minDate && normalized < normalizeDate(minDate)) return true
  if (maxDate && normalized > normalizeDate(maxDate)) return true
  return disabledDates.some((d) => normalizeDate(d).getTime() === normalized.getTime())
}

function clampHour(raw: string): string {
  const n = parseInt(raw, 10)
  if (isNaN(n) || n < 1) return '12'
  if (n > 12) return '12'
  return String(n)
}

function clampMinute(raw: string): string {
  const n = parseInt(raw, 10)
  if (isNaN(n) || n < 0) return '00'
  if (n > 59) return '59'
  return String(n).padStart(2, '0')
}

function safeDate(d: Date | undefined | null): Date {
  if (d instanceof Date && !isNaN(d.getTime())) return d
  return new Date()
}

type DateView = 'calendar' | 'year'

export const DateTimePicker = ({
  initialDate,
  hasInitialTime = false,
  onSave,
  onCancel,
  mode = 'datetime',
  minDate,
  maxDate,
  disabledDates = [],
}: DateTimePickerProps) => {
  const showDateSection = mode !== 'time'
  const showTimeSection = mode !== 'date'

  const [timeEnabled, setTimeEnabled] = useState(mode === 'time' || hasInitialTime)
  const [dateView, setDateView] = useState<DateView>('calendar')
  const [selected, setSelected] = useState<Date>(() => safeDate(initialDate))
  const [viewMonth, setViewMonth] = useState(selected.getMonth())
  const [viewYear, setViewYear] = useState(selected.getFullYear())
  const [hourField, setHourField] = useState(String(selected.getHours() % 12 || 12))
  const [minuteField, setMinuteField] = useState(String(selected.getMinutes()).padStart(2, '0'))
  const [meridiem, setMeridiem] = useState<'AM' | 'PM'>(selected.getHours() >= 12 ? 'PM' : 'AM')

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstWeekday = getFirstWeekday(viewYear, viewMonth)
  const today = new Date()
  const yearOptions = useMemo(() => Array.from({ length: 15 }, (_, i) => viewYear - 2 + i), [viewYear])

  const weekdayLabel = selected.toLocaleDateString('en-US', { weekday: 'short' })
  const monthShort = selected.toLocaleDateString('en-US', { month: 'short' })

  function handleSelectDate(day: number) {
    const next = new Date(selected)
    next.setFullYear(viewYear, viewMonth, day)
    if (isDateDisabled(next, minDate, maxDate, disabledDates)) return
    setSelected(next)
  }

  function handleSelectYear(year: number) {
    setViewYear(year)
    const next = new Date(selected)
    next.setFullYear(year)
    setSelected(next)
    setDateView('calendar')
  }

  function handleSave() {
    const final = new Date(selected)
    const effectiveHasTime = showTimeSection && timeEnabled
    if (effectiveHasTime) {
      const h12 = parseInt(hourField, 10) || 12
      const clamped = Math.min(12, Math.max(1, h12))
      const min = parseInt(minuteField, 10) || 0
      const clampedMin = Math.min(59, Math.max(0, min))
      let h24: number
      if (meridiem === 'AM') {
        h24 = clamped === 12 ? 0 : clamped
      } else {
        h24 = clamped === 12 ? 12 : clamped + 12
      }
      final.setHours(h24, clampedMin, 0, 0)
    } else {
      final.setHours(0, 0, 0, 0)
    }
    onSave(final, effectiveHasTime)
  }

  function handleTimeInput(value: string, target: 'hour' | 'minute') {
    const sanitized = value.replace(/\D/g, '').slice(0, 2)
    if (target === 'hour') setHourField(sanitized)
    else setMinuteField(sanitized)
  }

  const handleHourBlur = useCallback(() => setHourField(prev => clampHour(prev)), [])
  const handleMinuteBlur = useCallback(() => setMinuteField(prev => clampMinute(prev)), [])

  const navBtnCls = 'tap-target flex items-center justify-center rounded-full border border-border transition hover:border-[var(--border-focus)] hover:bg-[var(--brand-tint)]'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose date and time"
      className="w-[calc(100vw-2rem)] max-w-[22rem] overflow-hidden rounded-t-2xl border border-border bg-card shadow-popup md:rounded-2xl"
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
    >
      {/* Drag handle */}
      <div className="flex justify-center pt-2 pb-1 md:hidden">
        <div className="h-1 w-10 rounded-full bg-muted-foreground/25" />
      </div>

      {/* ── DATE SECTION ─────────────────────────────── */}
      {showDateSection && (
        <>
          {/* Date header — brand-tint background, visually distinct but not dark */}
          <div className="bg-[var(--brand-tint)] border-b border-border px-5 pt-4 pb-3">
            <button
              type="button"
              onClick={() => setDateView(v => v === 'calendar' ? 'year' : 'calendar')}
              className="group flex items-baseline gap-2"
              aria-label="Tap to change year"
            >
              <span className={cn(
                'text-2xl font-semibold transition-colors',
                dateView === 'year' ? 'text-muted-foreground' : 'text-foreground group-hover:text-[var(--brand-text)]'
              )}>
                {weekdayLabel}, {selected.getDate()} {monthShort}
              </span>
              <span className={cn(
                'text-sm font-medium transition-colors',
                dateView === 'year' ? 'text-[var(--brand-text)]' : 'text-muted-foreground'
              )}>
                {viewYear}
              </span>
            </button>
          </div>

          {dateView === 'calendar' ? (
            <div className="px-4 py-3">
              {/* Month nav */}
              <div className="mb-2 flex items-center justify-between">
                <button type="button" aria-label="Previous month" className={navBtnCls}
                  onClick={() => {
                    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
                    else setViewMonth(m => m - 1)
                  }}
                >
                  <ChevronLeft size={18} />
                </button>
                <p className="text-sm font-semibold text-foreground">{MONTHS[viewMonth]} {viewYear}</p>
                <button type="button" aria-label="Next month" className={navBtnCls}
                  onClick={() => {
                    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
                    else setViewMonth(m => m + 1)
                  }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Weekday headers */}
              <div className="grid grid-cols-7 mb-1">
                {WEEKDAYS.map((day, i) => (
                  <div key={`${day}-${i}`} className="py-1 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{day}</div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7">
                {Array.from({ length: firstWeekday }).map((_, i) => <div key={`e-${i}`} />)}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const isSelected = selected.getDate() === day && selected.getMonth() === viewMonth && selected.getFullYear() === viewYear
                  const isToday = today.getDate() === day && today.getMonth() === viewMonth && today.getFullYear() === viewYear
                  const disabled = isDateDisabled(new Date(viewYear, viewMonth, day), minDate, maxDate, disabledDates)
                  return (
                    <button
                      key={day}
                      type="button"
                      aria-label={`${MONTHS[viewMonth]} ${day}, ${viewYear}`}
                      onClick={() => handleSelectDate(day)}
                      disabled={disabled}
                      className={cn(
                        'tap-target mx-auto rounded-full text-sm font-medium transition active:scale-95',
                        disabled && 'cursor-not-allowed opacity-40',
                        isSelected ? 'bg-[var(--brand)] text-white' :
                        isToday ? 'border-2 border-[var(--brand)] text-[var(--brand-text)]' :
                        'text-foreground hover:bg-[var(--brand-tint)]'
                      )}
                    >
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="max-h-60 divide-y divide-border overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {yearOptions.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => handleSelectYear(year)}
                  className={cn(
                    'w-full px-6 py-3 text-left transition hover:bg-accent',
                    year === viewYear ? 'text-xl font-semibold text-[var(--brand-text)]' : 'text-base font-medium text-foreground/70'
                  )}
                >
                  {year}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── TIME SECTION ────────────────────────────── */}
      {showTimeSection && (
        <div className="border-t border-border">
          {!timeEnabled ? (
            <button
              type="button"
              onClick={() => setTimeEnabled(true)}
              className="flex w-full items-center gap-2 px-5 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-[var(--brand-text)]"
            >
              <Clock size={15} />
              Add time
            </button>
          ) : (
            /* Compact time row — no clock dial */
            <div className="flex items-center gap-3 bg-[var(--brand-tint)] px-5 py-3">
              {/* Hour */}
              <input
                type="text"
                inputMode="numeric"
                value={hourField}
                onChange={e => handleTimeInput(e.target.value, 'hour')}
                onBlur={handleHourBlur}
                maxLength={2}
                className="w-9 border-b-2 border-[var(--brand)] bg-transparent text-center text-xl font-semibold text-[var(--brand-text)] outline-none"
                aria-label="Hour"
              />
              <span className="text-xl font-semibold text-foreground/40">:</span>
              {/* Minute */}
              <input
                type="text"
                inputMode="numeric"
                value={minuteField}
                onChange={e => handleTimeInput(e.target.value, 'minute')}
                onBlur={handleMinuteBlur}
                maxLength={2}
                className="w-9 border-b-2 border-border bg-transparent text-center text-xl font-semibold text-foreground outline-none"
                aria-label="Minute"
              />
              {/* AM/PM */}
              <div className="ml-1 flex flex-col gap-1">
                {(['AM', 'PM'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMeridiem(m)}
                    className={cn(
                      'rounded px-2 py-0.5 text-xs font-semibold transition',
                      meridiem === m
                        ? 'bg-[var(--brand)] text-white'
                        : 'border border-border bg-background text-muted-foreground hover:border-[var(--brand)]'
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
              {/* Remove time */}
              <button
                type="button"
                onClick={() => setTimeEnabled(false)}
                className="ml-auto tap-target flex items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Remove time"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-end gap-3 border-t border-border px-5 py-3">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] rounded border border-border px-5 text-sm font-semibold text-foreground transition hover:border-[var(--border-focus)] hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="min-h-[44px] rounded bg-[var(--brand)] px-5 text-sm font-semibold text-white shadow-brand transition hover:bg-[var(--brand-hover)] active:scale-95"
        >
          Save
        </button>
      </div>
    </div>
  )
}

export default DateTimePicker
