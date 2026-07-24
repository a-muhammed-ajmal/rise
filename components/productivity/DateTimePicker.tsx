'use client'

import { useMemo, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, ChevronDown, Keyboard, Clock, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DateTimePickerProps {
  initialDate?: Date
  /** Pass true when the task already has an explicit saved time — keeps time section open */
  hasInitialTime?: boolean
  onSave: (date: Date, hasTime: boolean) => void
  onCancel: () => void
  mode?: 'date' | 'time' | 'datetime'
  minDate?: Date
  maxDate?: Date
  disabledDates?: Date[]
}

type DateView = 'calendar' | 'year'
type TimeView = 'dial' | 'manual'
type DialPhase = 'hour' | 'minute'

const INPUT_CLS = 'w-16 border-b-2 px-1 py-1 text-2xl font-semibold bg-transparent outline-none transition-colors'
const SUB_LABEL_CLS = 'mt-1 text-xs text-muted-foreground'

const MINUTE_VALUES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] as const
const HOUR_VALUES = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const

interface TimeInputsProps {
  hourField: string
  minuteField: string
  meridiem: 'AM' | 'PM'
  activeInput: 'hour' | 'minute' | null
  onHourChange: (v: string) => void
  onMinuteChange: (v: string) => void
  onMeridiemChange: (v: 'AM' | 'PM') => void
  onHourFocus: () => void
  onMinuteFocus: () => void
  onHourBlur: () => void
  onMinuteBlur: () => void
}

function TimeInputs({
  hourField, minuteField, meridiem,
  activeInput,
  onHourChange, onMinuteChange, onMeridiemChange,
  onHourFocus, onMinuteFocus,
  onHourBlur, onMinuteBlur,
}: TimeInputsProps) {
  return (
    <div className="flex items-end gap-2">
      <div>
        <input
          value={hourField}
          onChange={e => onHourChange(e.target.value)}
          onFocus={onHourFocus}
          onBlur={onHourBlur}
          className={cn(
            INPUT_CLS,
            activeInput === 'hour'
              ? 'border-[var(--brand)] text-[var(--brand-text)]'
              : 'border-border text-foreground'
          )}
          aria-label="Hour"
        />
        <p className={SUB_LABEL_CLS}>hour</p>
      </div>
      <span className="pb-2 text-2xl font-semibold text-foreground">:</span>
      <div>
        <input
          value={minuteField}
          onChange={e => onMinuteChange(e.target.value)}
          onFocus={onMinuteFocus}
          onBlur={onMinuteBlur}
          className={cn(
            INPUT_CLS,
            activeInput === 'minute'
              ? 'border-[var(--brand)] text-[var(--brand-text)]'
              : 'border-border text-foreground'
          )}
          aria-label="Minute"
        />
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

  // Time starts enabled only when mode is time-only or task already had an explicit time
  const [timeEnabled, setTimeEnabled] = useState(mode === 'time' || hasInitialTime)
  const [dateView, setDateView] = useState<DateView>('calendar')
  const [timeView, setTimeView] = useState<TimeView>('dial')
  const [dialPhase, setDialPhase] = useState<DialPhase>('hour')
  const [selected, setSelected] = useState<Date>(() => safeDate(initialDate))
  const [viewMonth, setViewMonth] = useState(selected.getMonth())
  const [viewYear, setViewYear] = useState(selected.getFullYear())
  const [hourField, setHourField] = useState(String(selected.getHours() % 12 || 12))
  const [minuteField, setMinuteField] = useState(String(selected.getMinutes()).padStart(2, '0'))
  const [meridiem, setMeridiem] = useState<'AM' | 'PM'>(selected.getHours() >= 12 ? 'PM' : 'AM')
  const [activeInput, setActiveInput] = useState<'hour' | 'minute' | null>(null)

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
    if (target === 'hour') {
      setHourField(sanitized)
    } else {
      setMinuteField(sanitized)
    }
  }

  const handleHourBlur = useCallback(() => {
    setHourField(prev => clampHour(prev))
    setActiveInput(null)
  }, [])

  const handleMinuteBlur = useCallback(() => {
    setMinuteField(prev => clampMinute(prev))
    setActiveInput(null)
  }, [])

  function handleDialHourSelect(value: number) {
    setHourField(String(value))
    setDialPhase('minute')
  }

  function handleDialMinuteSelect(value: number) {
    setMinuteField(String(value).padStart(2, '0'))
  }

  const navBtnCls = 'tap-target flex items-center justify-center rounded-full border border-border transition hover:border-[var(--border-focus)] hover:bg-[var(--brand-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]'

  const timeInputsProps: TimeInputsProps = {
    hourField,
    minuteField,
    meridiem,
    activeInput,
    onHourChange: (v) => handleTimeInput(v, 'hour'),
    onMinuteChange: (v) => handleTimeInput(v, 'minute'),
    onMeridiemChange: setMeridiem,
    onHourFocus: () => { setActiveInput('hour'); setDialPhase('hour') },
    onMinuteFocus: () => { setActiveInput('minute'); setDialPhase('minute') },
    onHourBlur: handleHourBlur,
    onMinuteBlur: handleMinuteBlur,
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

      {/* ── DATE SECTION ─────────────────────────────────── */}
      {showDateSection && (
        <>
          {/* Selected date — light, no dark band */}
          <div className="px-5 pt-4 pb-2">
            <button
              type="button"
              onClick={() => setDateView(v => v === 'calendar' ? 'year' : 'calendar')}
              className="group flex items-baseline gap-2"
              aria-label={`${weekdayLabel} ${selected.getDate()} ${monthShort} ${viewYear} — tap to change year`}
            >
              <span className={cn(
                'text-2xl font-semibold transition-colors',
                dateView === 'year'
                  ? 'text-muted-foreground'
                  : 'text-foreground group-hover:text-[var(--brand-text)]'
              )}>
                {weekdayLabel}, {selected.getDate()} {monthShort}
              </span>
              <span className={cn(
                'text-sm transition-colors',
                dateView === 'year' ? 'text-[var(--brand-text)]' : 'text-muted-foreground'
              )}>
                {viewYear}
              </span>
            </button>
          </div>

          {dateView === 'calendar' ? (
            <div className="px-5 pb-2">
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

      {/* ── TIME SECTION (optional toggle) ─────────────────────────────── */}
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
            <>
              {/* Time display — light orange tint, no dark navy */}
              <div className="flex items-center justify-between bg-[var(--brand-tint)] px-5 py-3">
                <div className="flex items-baseline gap-0.5">
                  <button
                    type="button"
                    onClick={() => { setDialPhase('hour'); setTimeView('dial') }}
                    className={cn(
                      'text-4xl font-semibold tracking-tight transition-colors',
                      dialPhase === 'hour' ? 'text-[var(--brand-text)]' : 'text-foreground/50'
                    )}
                    aria-label="Select hour"
                  >
                    {hourField || '12'}
                  </button>
                  <span className="text-4xl font-semibold text-foreground/30">:</span>
                  <button
                    type="button"
                    onClick={() => { setDialPhase('minute'); setTimeView('dial') }}
                    className={cn(
                      'text-4xl font-semibold tracking-tight transition-colors',
                      dialPhase === 'minute' ? 'text-[var(--brand-text)]' : 'text-foreground/50'
                    )}
                    aria-label="Select minute"
                  >
                    {minuteField || '00'}
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col gap-1 text-xs font-semibold">
                    {(['AM', 'PM'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMeridiem(m)}
                        className={cn(
                          'rounded px-2 py-0.5 transition',
                          meridiem === m
                            ? 'bg-[var(--brand)] text-white'
                            : 'border border-border bg-background text-muted-foreground hover:border-[var(--brand)]'
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setTimeEnabled(false)}
                    className="tap-target flex items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    aria-label="Remove time"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Clock dial */}
              {timeView === 'dial' && (
                <div className="px-6 py-5">
                  <div className="mb-3 flex items-center justify-center gap-4">
                    <button
                      type="button"
                      onClick={() => setDialPhase('hour')}
                      className={cn(
                        'text-xs font-semibold uppercase tracking-wider transition-colors',
                        dialPhase === 'hour' ? 'text-[var(--brand-text)]' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      Hour
                    </button>
                    <span className="text-muted-foreground/40">→</span>
                    <button
                      type="button"
                      onClick={() => setDialPhase('minute')}
                      className={cn(
                        'text-xs font-semibold uppercase tracking-wider transition-colors',
                        dialPhase === 'minute' ? 'text-[var(--brand-text)]' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      Minute
                    </button>
                  </div>

                  <div className="relative mx-auto flex h-52 w-52 items-center justify-center rounded-full border border-border bg-muted/30">
                    <div className="absolute h-2 w-2 rounded-full bg-[var(--brand)]" />
                    {dialPhase === 'hour' ? (
                      HOUR_VALUES.map((value, index) => {
                        const angle = (index * 30 * Math.PI) / 180
                        const radius = 86
                        const x = 104 + radius * Math.sin(angle)
                        const y = 104 - radius * Math.cos(angle)
                        const isActive = (parseInt(hourField, 10) || 12) === value
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => handleDialHourSelect(value)}
                            style={{ left: x - 18, top: y - 18 }}
                            className={cn(
                              'tap-target absolute flex items-center justify-center rounded-full text-sm font-medium transition',
                              isActive ? 'bg-[var(--brand)] text-white' : 'text-foreground/70 hover:bg-[var(--brand-tint)]'
                            )}
                          >
                            {value}
                          </button>
                        )
                      })
                    ) : (
                      MINUTE_VALUES.map((value, index) => {
                        const angle = (index * 30 * Math.PI) / 180
                        const radius = 86
                        const x = 104 + radius * Math.sin(angle)
                        const y = 104 - radius * Math.cos(angle)
                        const isActive = (parseInt(minuteField, 10) || 0) === value
                        return (
                          <button
                            key={value}
                            type="button"
                            onClick={() => handleDialMinuteSelect(value)}
                            style={{ left: x - 18, top: y - 18 }}
                            className={cn(
                              'tap-target absolute flex items-center justify-center rounded-full text-sm font-medium transition',
                              isActive ? 'bg-[var(--brand)] text-white' : 'text-foreground/70 hover:bg-[var(--brand-tint)]'
                            )}
                          >
                            {String(value).padStart(2, '0')}
                          </button>
                        )
                      })
                    )}
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <TimeInputs {...timeInputsProps} />
                    <button type="button" aria-label="Switch to manual entry" onClick={() => setTimeView('manual')} className={navBtnCls}>
                      <Keyboard size={18} />
                    </button>
                  </div>
                </div>
              )}

              {/* Manual keyboard entry */}
              {timeView === 'manual' && (
                <div className="px-6 py-5">
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
        </div>
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
