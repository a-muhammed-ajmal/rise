'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Keyboard, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DateTimePickerProps {
  initialDate?: Date
  onSave: (date: Date) => void
  onCancel: () => void
  mode?: 'date' | 'time' | 'datetime'
  minDate?: Date
  maxDate?: Date
  disabledDates?: Date[]
}

type DateView = 'calendar' | 'year'
type TimeView = 'dial' | 'manual'

const INPUT_CLS = 'w-16 border-b-2 border-border px-1 py-1 text-2xl font-semibold text-foreground bg-transparent outline-none focus:border-[var(--border-focus)]'
const SUB_LABEL_CLS = 'mt-1 text-xs text-muted-foreground'

interface TimeInputsProps {
  hourField: string
  minuteField: string
  meridiem: 'AM' | 'PM'
  onHourChange: (v: string) => void
  onMinuteChange: (v: string) => void
  onMeridiemChange: (v: 'AM' | 'PM') => void
}

function TimeInputs({ hourField, minuteField, meridiem, onHourChange, onMinuteChange, onMeridiemChange }: TimeInputsProps) {
  return (
    <div className="flex items-end gap-2">
      <div>
        <input value={hourField} onChange={e => onHourChange(e.target.value)} className={INPUT_CLS} aria-label="Hour" />
        <p className={SUB_LABEL_CLS}>hour</p>
      </div>
      <span className="pb-2 text-2xl font-semibold text-foreground">:</span>
      <div>
        <input value={minuteField} onChange={e => onMinuteChange(e.target.value)} className={INPUT_CLS} aria-label="Minute" />
        <p className={SUB_LABEL_CLS}>minute</p>
      </div>
      <div className="relative ml-3 mb-1">
        <select
          value={meridiem}
          onChange={e => onMeridiemChange(e.target.value as 'AM' | 'PM')}
          className="h-11 appearance-none rounded border border-border pl-3 pr-8 text-sm font-semibold text-foreground bg-background outline-none focus:border-[var(--border-focus)]"
          aria-label="AM or PM"
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
        <ChevronDown size={16} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  )
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

export const DateTimePicker = ({
  initialDate,
  onSave,
  onCancel,
  mode = 'datetime',
  minDate,
  maxDate,
  disabledDates = [],
}: DateTimePickerProps) => {
  const [tab, setTab] = useState<'date' | 'time'>(mode === 'time' ? 'time' : 'date')
  const [dateView, setDateView] = useState<DateView>('calendar')
  const [timeView, setTimeView] = useState<TimeView>('dial')
  const [selected, setSelected] = useState<Date>(initialDate ?? new Date())
  const [viewMonth, setViewMonth] = useState(selected.getMonth())
  const [viewYear, setViewYear] = useState(selected.getFullYear())
  const [hourField, setHourField] = useState(String(selected.getHours() % 12 || 12))
  const [minuteField, setMinuteField] = useState(String(selected.getMinutes()).padStart(2, '0'))
  const [meridiem, setMeridiem] = useState<'AM' | 'PM'>(selected.getHours() >= 12 ? 'PM' : 'AM')

  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstWeekday = getFirstWeekday(viewYear, viewMonth)
  const today = new Date()
  const showDateTab = mode !== 'time'
  const showTimeTab = mode !== 'date'

  const weekdayLabel = selected.toLocaleDateString('en-US', { weekday: 'short' })
  const monthShort = selected.toLocaleDateString('en-US', { month: 'short' })
  const yearOptions = useMemo(() => Array.from({ length: 15 }, (_, i) => viewYear - 2 + i), [viewYear])

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
    if (showTimeTab) {
      let hour = parseInt(hourField, 10) % 12
      if (isNaN(hour)) hour = 0
      if (meridiem === 'PM' && hour !== 12) hour += 12
      if (meridiem === 'AM' && hour === 12) hour = 0
      final.setHours(hour, parseInt(minuteField, 10) || 0, 0, 0)
    } else {
      final.setHours(selected.getHours(), selected.getMinutes(), 0, 0)
    }
    onSave(final)
  }

  function handleTimeInput(value: string, target: 'hour' | 'minute') {
    const sanitized = value.replace(/\D/g, '').slice(0, 2)
    if (target === 'hour') setHourField(sanitized || '1')
    else setMinuteField(sanitized || '00')
  }

  const navBtnCls = 'tap-target flex items-center justify-center rounded-full border border-border transition hover:border-[var(--border-focus)] hover:bg-[var(--brand-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]'

  const timeInputsProps: TimeInputsProps = {
    hourField,
    minuteField,
    meridiem,
    onHourChange: (v) => handleTimeInput(v, 'hour'),
    onMinuteChange: (v) => handleTimeInput(v, 'minute'),
    onMeridiemChange: setMeridiem,
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose date and time"
      className="w-full max-w-[22rem] overflow-hidden rounded-t-2xl border border-border bg-card shadow-popup md:rounded-2xl"
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
    >
      {/* Drag handle (mobile) */}
      <div className="flex justify-center pt-2 pb-1 md:hidden">
        <div className="h-1 w-10 rounded-full bg-muted-foreground/25" />
      </div>

      {/* Tab strip */}
      {showDateTab && showTimeTab && (
        <div className="flex border-b border-border">
          {(['date', 'time'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 py-3 text-sm font-semibold uppercase transition-colors',
                tab === t
                  ? 'border-b-2 border-[var(--brand)] text-[var(--brand-text)]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t}
            </button>
          ))}
        </div>
      )}

      {/* ── DATE TAB ─────────────────────────────────── */}
      {showDateTab && tab === 'date' && (
        <>
          {/* Dark header band */}
          <button
            type="button"
            onClick={() => setDateView(v => v === 'calendar' ? 'year' : 'calendar')}
            className="relative w-full overflow-hidden bg-[var(--surface-dark)] px-6 py-6 text-left graph-bg-dark"
          >
            <p className="mb-1 text-xs text-white/70">{viewYear}</p>
            <p className={cn('text-3xl font-semibold tracking-tight text-white', dateView === 'year' && 'text-white/40')}>
              {weekdayLabel}, {selected.getDate()} {monthShort}
            </p>
          </button>

          {dateView === 'calendar' ? (
            <div className="px-5 py-4">
              {/* Month nav */}
              <div className="mb-3 flex items-center justify-between">
                <button type="button" aria-label="Previous month" className={navBtnCls}
                  onClick={() => {
                    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
                    else setViewMonth(m => m - 1)
                  }}
                >
                  <ChevronLeft size={18} />
                </button>
                <p className="text-base font-semibold text-foreground">{MONTHS[viewMonth]} {viewYear}</p>
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
              <div className="mb-1 grid grid-cols-7">
                {WEEKDAYS.map((day, i) => (
                  <div key={`${day}-${i}`} className="py-2 text-center text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{day}</div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-y-1">
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
            /* Year picker */
            <div className="max-h-72 divide-y divide-border overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {yearOptions.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => handleSelectYear(year)}
                  className={cn(
                    'w-full px-6 py-3 text-left transition hover:bg-accent',
                    year === viewYear
                      ? 'text-2xl font-semibold text-[var(--brand-text)]'
                      : 'text-base font-medium text-foreground/70'
                  )}
                >
                  {year}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── TIME TAB ─────────────────────────────────── */}
      {showTimeTab && tab === 'time' && (
        <>
          {/* Dark time header */}
          <div className="flex items-center justify-between bg-[var(--surface-dark)] px-6 py-6 graph-bg-dark">
            <p className="text-5xl font-semibold tracking-tight text-white">{hourField}:{minuteField}</p>
            <div className="flex flex-col gap-1 text-sm font-semibold">
              {(['AM', 'PM'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMeridiem(m)}
                  className={cn('rounded px-2 py-1 transition', meridiem === m ? 'bg-[var(--brand)] text-white' : 'text-white/40 hover:text-white/70')}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {/* Clock dial — hidden when manual mode active */}
          {timeView === 'dial' && (
            <div className="px-6 py-6">
              <div className="relative mx-auto flex h-56 w-56 items-center justify-center rounded-full border border-border bg-muted/30">
                {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((value, index) => {
                  const angle = (index * 30 * Math.PI) / 180
                  const radius = 92
                  const x = 112 + radius * Math.sin(angle)
                  const y = 112 - radius * Math.cos(angle)
                  const isActive = parseInt(hourField, 10) === value || (value === 12 && hourField === '12')
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setHourField(String(value))}
                      style={{ left: x - 18, top: y - 18 }}
                      className={cn(
                        'tap-target absolute flex items-center justify-center rounded-full text-sm font-medium transition',
                        isActive ? 'bg-[var(--brand)] text-white' : 'text-foreground/70 hover:bg-[var(--brand-tint)]'
                      )}
                    >
                      {value}
                    </button>
                  )
                })}
              </div>

              <div className="mt-6 flex items-center justify-between gap-3">
                <TimeInputs {...timeInputsProps} />
                <button type="button" aria-label="Switch to manual entry" onClick={() => setTimeView('manual')} className={navBtnCls}>
                  <Keyboard size={18} />
                </button>
              </div>
            </div>
          )}

          {/* Manual entry — hidden when dial mode active */}
          {timeView === 'manual' && (
            <div className="px-6 py-6">
              <p className="mb-3 text-sm font-medium text-foreground/70">Type in time</p>
              <div className="mb-4">
                <TimeInputs {...timeInputsProps} />
              </div>
              <button type="button" aria-label="Switch to clock dial" onClick={() => setTimeView('dial')} className={navBtnCls}>
                <Clock size={18} />
              </button>
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] rounded border border-border px-5 text-sm font-semibold text-foreground transition hover:border-[var(--border-focus)] hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="min-h-[44px] rounded bg-[var(--brand)] px-5 text-sm font-semibold text-white shadow-brand transition hover:bg-[var(--brand-hover)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"
        >
          Save
        </button>
      </div>
    </div>
  )
}

export default DateTimePicker
