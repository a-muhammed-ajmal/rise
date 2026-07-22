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
  return disabledDates.some((disabled) => normalizeDate(disabled).getTime() === normalized.getTime())
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
  const [tab, setTab] = useState<'date' | 'time'>(mode === 'date' ? 'date' : mode === 'time' ? 'time' : 'date')
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
  const yearOptions = useMemo(() => Array.from({ length: 15 }, (_, index) => viewYear - 2 + index), [viewYear])

  const handleSelectDate = (day: number) => {
    const next = new Date(selected)
    next.setFullYear(viewYear, viewMonth, day)
    if (isDateDisabled(next, minDate, maxDate, disabledDates)) return
    setSelected(next)
  }

  const handleSelectYear = (year: number) => {
    setViewYear(year)
    const next = new Date(selected)
    next.setFullYear(year)
    setSelected(next)
    setDateView('calendar')
  }

  const handleSave = () => {
    const final = new Date(selected)
    if (showTimeTab) {
      let hour = Number.parseInt(hourField, 10) % 12
      if (Number.isNaN(hour)) hour = 0
      if (meridiem === 'PM' && hour !== 12) hour += 12
      if (meridiem === 'AM' && hour === 12) hour = 0
      final.setHours(hour, Number.parseInt(minuteField, 10) || 0, 0, 0)
    } else {
      final.setHours(selected.getHours(), selected.getMinutes(), 0, 0)
    }
    onSave(final)
  }

  const handleTimeInput = (value: string, target: 'hour' | 'minute') => {
    const sanitized = value.replace(/\D/g, '').slice(0, 2)
    if (target === 'hour') {
      setHourField(sanitized || '1')
    } else {
      setMinuteField(sanitized || '00')
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose date and time"
      className="w-full max-w-[22rem] overflow-hidden rounded-t-2xl border-[1.5px] border-[rgba(26,26,46,0.16)] bg-white shadow-[0_-4px_24px_rgba(26,26,46,0.12)] md:rounded-2xl"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onCancel()
      }}
    >
      <div className="flex justify-center pt-2 pb-1 md:hidden">
        <div className="h-1 w-10 rounded-full bg-[rgba(26,26,46,0.16)]" />
      </div>

      {showDateTab && showTimeTab ? (
        <div className="flex border-b border-[rgba(26,26,46,0.13)]">
          <button type="button" onClick={() => setTab('date')} className={cn('flex-1 py-3 text-sm font-semibold uppercase transition-colors', tab === 'date' ? 'border-b-2 border-[var(--brand)] text-[var(--brand-text)]' : 'text-[rgba(26,26,46,0.5)]')}>Date</button>
          <button type="button" onClick={() => setTab('time')} className={cn('flex-1 py-3 text-sm font-semibold uppercase transition-colors', tab === 'time' ? 'border-b-2 border-[var(--brand)] text-[var(--brand-text)]' : 'text-[rgba(26,26,46,0.5)]')}>Time</button>
        </div>
      ) : null}

      {showDateTab && tab === 'date' ? (
        <>
          <button
            type="button"
            onClick={() => setDateView(dateView === 'calendar' ? 'year' : 'calendar')}
            className="relative w-full overflow-hidden bg-[var(--surface-dark)] px-6 py-6 text-left graph-bg-dark"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,101,53,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,101,53,0.09) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          >
            <p className="mb-1 text-xs text-white/70">{viewYear}</p>
            <p className={cn('text-3xl font-semibold tracking-tight text-white', dateView === 'year' && 'text-white/40')}>
              {weekdayLabel}, {selected.getDate()} {monthShort}
            </p>
          </button>

          {dateView === 'calendar' ? (
            <div className="px-5 py-4">
              <div className="mb-3 flex items-center justify-between">
                <button type="button" aria-label="Previous month" onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear((year) => year - 1) } else { setViewMonth((month) => month - 1) } }} className="tap-target flex items-center justify-center rounded-full border-[1.5px] border-[rgba(26,26,46,0.16)] transition hover:border-[var(--border-focus)] hover:bg-[var(--brand-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]">
                  <ChevronLeft size={18} />
                </button>
                <p className="text-base font-semibold text-[var(--text-strong)]">{MONTHS[viewMonth]} {viewYear}</p>
                <button type="button" aria-label="Next month" onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear((year) => year + 1) } else { setViewMonth((month) => month + 1) } }} className="tap-target flex items-center justify-center rounded-full border-[1.5px] border-[rgba(26,26,46,0.16)] transition hover:border-[var(--border-focus)] hover:bg-[var(--brand-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]">
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="mb-1 grid grid-cols-7">
                {WEEKDAYS.map((day, index) => (
                  <div key={`${day}-${index}`} className="py-2 text-center text-[11px] font-semibold uppercase tracking-[0.15em] text-[rgba(26,26,46,0.5)]">{day}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-y-1">
                {Array.from({ length: firstWeekday }).map((_, index) => (<div key={`empty-${index}`} />))}
                {Array.from({ length: daysInMonth }, (_, index) => index + 1).map((day) => {
                  const isSelected = selected.getDate() === day && selected.getMonth() === viewMonth && selected.getFullYear() === viewYear
                  const isToday = today.getDate() === day && today.getMonth() === viewMonth && today.getFullYear() === viewYear
                  const disabled = isDateDisabled(new Date(viewYear, viewMonth, day), minDate, maxDate, disabledDates)
                  return (
                    <button key={day} type="button" aria-label={`${MONTHS[viewMonth]} ${day}, ${viewYear}`} onClick={() => handleSelectDate(day)} disabled={disabled} className={cn('tap-target mx-auto rounded-full text-sm font-medium transition active:scale-95', disabled && 'cursor-not-allowed opacity-40', isSelected ? 'bg-[var(--brand)] text-white' : isToday ? 'border-[1.5px] border-[var(--brand)] text-[var(--brand-text)]' : 'text-[var(--text-strong)] hover:bg-[var(--brand-tint)]')}>
                      {day}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="max-h-72 divide-y divide-[rgba(26,26,46,0.1)] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(26,26,46,0.25) transparent' }}>
              {yearOptions.map((year) => (
                <button key={year} type="button" onClick={() => handleSelectYear(year)} className={cn('w-full px-6 py-3 text-left transition', year === viewYear ? 'text-2xl font-semibold text-[var(--brand-text)]' : 'text-base font-medium text-[rgba(26,26,46,0.7)]')}>
                  {year}
                </button>
              ))}
            </div>
          )}
        </>
      ) : null}

      {showTimeTab && tab === 'time' ? (
        <>
          <div className="flex items-center justify-between bg-[var(--surface-dark)] px-6 py-6 graph-bg-dark" style={{ backgroundImage: 'linear-gradient(rgba(255,101,53,0.09) 1px, transparent 1px), linear-gradient(90deg, rgba(255,101,53,0.09) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
            <p className="text-5xl font-semibold tracking-tight text-white">{hourField}:{minuteField}</p>
            <div className="flex flex-col gap-1 text-sm font-semibold">
              <button type="button" onClick={() => setMeridiem('AM')} className={cn('rounded px-2 py-1 transition', meridiem === 'AM' ? 'bg-[var(--brand)] text-white' : 'text-white/40')}>AM</button>
              <button type="button" onClick={() => setMeridiem('PM')} className={cn('rounded px-2 py-1 transition', meridiem === 'PM' ? 'bg-[var(--brand)] text-white' : 'text-white/40')}>PM</button>
            </div>
          </div>

          <div className="px-6 py-6">
            <div className="relative mx-auto flex h-56 w-56 items-center justify-center rounded-full border-[1.5px] border-[rgba(26,26,46,0.14)] bg-[var(--surface-paper)]">
              {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((value, index) => {
                const angle = (index * 30 * Math.PI) / 180
                const radius = 92
                const x = 112 + radius * Math.sin(angle)
                const y = 112 - radius * Math.cos(angle)
                const isSelectedHour = Number.parseInt(hourField, 10) === value || (value === 12 && hourField === '12')
                return (
                  <button key={value} type="button" onClick={() => setHourField(String(value))} style={{ left: x - 18, top: y - 18 }} className={cn('tap-target absolute flex items-center justify-center rounded-full text-sm font-medium transition', isSelectedHour ? 'bg-[var(--brand)] text-white' : 'text-[rgba(26,26,46,0.7)] hover:bg-[var(--brand-tint)]')}>
                    {value}
                  </button>
                )
              })}
            </div>
            <div className="mt-6 flex items-center justify-between gap-3">
              <div className="flex flex-1 items-end gap-2">
                <div>
                  <input value={hourField} onChange={(event) => handleTimeInput(event.target.value, 'hour')} className="w-16 border-b-[1.5px] border-[rgba(26,26,46,0.18)] px-1 py-1 text-2xl font-semibold text-[var(--text-strong)] outline-none focus:border-[var(--border-focus)]" aria-label="Hour" />
                  <p className="mt-1 text-xs text-[rgba(26,26,46,0.5)]">hour</p>
                </div>
                <span className="pb-2 text-2xl font-semibold text-[var(--text-strong)]">:</span>
                <div>
                  <input value={minuteField} onChange={(event) => handleTimeInput(event.target.value, 'minute')} className="w-16 border-b-[1.5px] border-[rgba(26,26,46,0.18)] px-1 py-1 text-2xl font-semibold text-[var(--text-strong)] outline-none focus:border-[var(--border-focus)]" aria-label="Minute" />
                  <p className="mt-1 text-xs text-[rgba(26,26,46,0.5)]">minute</p>
                </div>
                <div className="relative ml-3 mb-1">
                  <select value={meridiem} onChange={(event) => setMeridiem(event.target.value as 'AM' | 'PM')} className="h-11 appearance-none rounded border-[1.5px] border-[rgba(26,26,46,0.18)] pl-3 pr-8 text-sm font-semibold text-[var(--text-strong)] outline-none focus:border-[var(--border-focus)]" aria-label="AM or PM">
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[rgba(26,26,46,0.5)]" />
                </div>
              </div>
              <button type="button" aria-label="Switch to manual entry" onClick={() => setTimeView('manual')} className="tap-target flex items-center justify-center rounded-full border-[1.5px] border-[rgba(26,26,46,0.16)] transition hover:border-[var(--border-focus)] hover:bg-[var(--brand-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"><Keyboard size={18} /></button>
            </div>
          </div>
        </>
      ) : null}

      {showTimeTab && tab === 'time' && timeView === 'manual' ? (
        <div className="px-6 py-6">
          <p className="mb-3 text-sm font-medium text-[rgba(26,26,46,0.7)]">Type in time</p>
          <div className="mb-2 flex items-end gap-2">
            <div><input value={hourField} onChange={(event) => handleTimeInput(event.target.value, 'hour')} className="w-16 border-b-[1.5px] border-[rgba(26,26,46,0.18)] px-1 py-1 text-2xl font-semibold text-[var(--text-strong)] outline-none focus:border-[var(--border-focus)]" aria-label="Hour" /><p className="mt-1 text-xs text-[rgba(26,26,46,0.5)]">hour</p></div>
            <span className="pb-2 text-2xl font-semibold text-[var(--text-strong)]">:</span>
            <div><input value={minuteField} onChange={(event) => handleTimeInput(event.target.value, 'minute')} className="w-16 border-b-[1.5px] border-[rgba(26,26,46,0.18)] px-1 py-1 text-2xl font-semibold text-[var(--text-strong)] outline-none focus:border-[var(--border-focus)]" aria-label="Minute" /><p className="mt-1 text-xs text-[rgba(26,26,46,0.5)]">minute</p></div>
            <div className="relative ml-3 mb-1"><select value={meridiem} onChange={(event) => setMeridiem(event.target.value as 'AM' | 'PM')} className="h-11 appearance-none rounded border-[1.5px] border-[rgba(26,26,46,0.18)] pl-3 pr-8 text-sm font-semibold text-[var(--text-strong)] outline-none focus:border-[var(--border-focus)]" aria-label="AM or PM"><option value="AM">AM</option><option value="PM">PM</option></select><ChevronDown size={16} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[rgba(26,26,46,0.5)]" /></div>
          </div>
          <button type="button" aria-label="Switch to clock dial" onClick={() => setTimeView('dial')} className="tap-target flex items-center justify-center rounded-full border-[1.5px] border-[rgba(26,26,46,0.16)] transition hover:border-[var(--border-focus)] hover:bg-[var(--brand-tint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]"><Clock size={18} /></button>
        </div>
      ) : null}

      <div className="flex justify-end gap-3 border-t border-[rgba(26,26,46,0.13)] px-6 py-4">
        <button type="button" onClick={onCancel} className="min-h-[44px] rounded border-[1.5px] border-[rgba(26,26,46,0.18)] px-5 text-sm font-semibold text-[var(--text-strong)] transition hover:border-[var(--border-focus)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]">Cancel</button>
        <button type="button" onClick={handleSave} className="min-h-[44px] rounded bg-[var(--brand)] px-5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(255,101,53,0.25)] transition hover:bg-[var(--brand-hover)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)]">Save</button>
      </div>
    </div>
  )
}

export default DateTimePicker
