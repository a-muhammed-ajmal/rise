'use client'

import { useRef, useState, useMemo } from 'react'
import {
  format, parseISO, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, isSameMonth, isToday,
  addMonths, subMonths, addDays, nextMonday,
} from 'date-fns'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DateTimePickerProps {
  value: { date?: string; time?: string }
  onChange: (v: { date?: string; time?: string }) => void
  onClose: () => void
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function deriveHour(time?: string): number {
  if (!time) return 9
  const h = parseInt(time.slice(0, 2), 10)
  if (h === 0) return 12
  if (h > 12) return h - 12
  return h
}

function deriveMinute(time?: string): number {
  if (!time) return 0
  const m = parseInt(time.slice(3, 5), 10)
  return (Math.round(m / 5) * 5) % 60
}

function deriveAmPm(time?: string): 'AM' | 'PM' {
  if (!time) return 'AM'
  return parseInt(time.slice(0, 2), 10) >= 12 ? 'PM' : 'AM'
}

function to24h(h: number, m: number, ap: 'AM' | 'PM'): string {
  let h24 = h
  if (ap === 'AM' && h === 12) h24 = 0
  else if (ap === 'PM' && h !== 12) h24 = h + 12
  return `${h24.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

// Angle (clockwise, 0 = 12 o'clock) → nearest of 12 face positions
function angleToIndex(clientX: number, clientY: number, rect: DOMRect): number {
  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2
  const dx = clientX - cx
  const dy = clientY - cy
  let theta = Math.atan2(dx, -dy)
  if (theta < 0) theta += 2 * Math.PI
  return Math.round(theta / (Math.PI / 6)) % 12
}

const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const FACE_RADIUS = 92
const HAND_LENGTH = 82

// ─── Component ────────────────────────────────────────────────────────────────

export function DateTimePicker({ value, onChange, onClose }: DateTimePickerProps) {
  const today = new Date()

  const [activeTab, setActiveTab] = useState<'date' | 'time'>('date')
  const [clockMode, setClockMode] = useState<'hour' | 'minute'>('hour')

  const [viewDate, setViewDate] = useState<Date>(() =>
    value.date ? parseISO(value.date) : today
  )
  const [localDate, setLocalDate] = useState<string>(() => value.date ?? format(today, 'yyyy-MM-dd'))
  const [hour, setHour] = useState<number>(() => deriveHour(value.time))
  const [minute, setMinute] = useState<number>(() => deriveMinute(value.time))
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(() => deriveAmPm(value.time))
  const [timeSet, setTimeSet] = useState<boolean>(!!value.time)

  const faceRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 1 })
    const end   = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [viewDate])

  const selectedDate = parseISO(localDate)

  function handleDayClick(day: Date) {
    setLocalDate(format(day, 'yyyy-MM-dd'))
  }

  function updateFromPoint(clientX: number, clientY: number) {
    const rect = faceRef.current?.getBoundingClientRect()
    if (!rect) return
    const idx = angleToIndex(clientX, clientY, rect)
    setTimeSet(true)
    if (clockMode === 'hour') setHour(idx === 0 ? 12 : idx)
    else setMinute(idx * 5)
  }

  function handleFacePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    updateFromPoint(e.clientX, e.clientY)
  }
  function handleFacePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    updateFromPoint(e.clientX, e.clientY)
  }
  function handleFacePointerUp() {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (clockMode === 'hour') setClockMode('minute')
  }

  function selectHour(h: number) {
    setHour(h)
    setTimeSet(true)
    setClockMode('minute')
  }
  function selectMinute(m: number) {
    setMinute(m)
    setTimeSet(true)
  }
  function selectAmpm(v: 'AM' | 'PM') {
    setAmpm(v)
    setTimeSet(true)
  }

  function handleSave() {
    onChange({
      date: localDate,
      time: timeSet ? to24h(hour, minute, ampm) : undefined,
    })
    onClose()
  }

  // Index 0 sits at the top of the face — "12" there for hours, "00" there for minutes —
  // matching the same index → angle mapping used for the hand (selectedFaceIndex below).
  const faceItems = clockMode === 'hour'
    ? Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i))
    : Array.from({ length: 12 }, (_, i) => i * 5)

  const selectedFaceIndex = clockMode === 'hour' ? hour % 12 : minute / 5
  const handAngleDeg = selectedFaceIndex * 30 - 180

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose date and time"
      className="bg-popover rounded-2xl shadow-popup ring-1 ring-foreground/10 w-80 overflow-hidden"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
    >
      {/* Tabs */}
      <div className="flex text-xs font-bold tracking-wide">
        <button
          type="button"
          onClick={() => setActiveTab('date')}
          className={cn(
            'flex-1 py-2.5 uppercase border-b-2 transition-colors',
            activeTab === 'date' ? 'text-brand border-brand' : 'text-muted-foreground border-transparent hover:text-foreground'
          )}
        >
          Date
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('time')}
          className={cn(
            'flex-1 py-2.5 uppercase border-b-2 transition-colors',
            activeTab === 'time' ? 'text-brand border-brand' : 'text-muted-foreground border-transparent hover:text-foreground'
          )}
        >
          Time
        </button>
      </div>

      {/* Colored preview band */}
      <div className="bg-brand text-white px-4 py-4">
        {activeTab === 'date' ? (
          <>
            <p className="text-xs text-white/70 font-medium">{format(selectedDate, 'yyyy')}</p>
            <p className="text-2xl font-bold mt-0.5">{format(selectedDate, 'EEE, d MMM')}</p>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-4xl font-bold tabular-nums flex items-baseline gap-1">
              <button
                type="button"
                onClick={() => setClockMode('hour')}
                className={cn('transition-opacity', clockMode !== 'hour' && 'opacity-60')}
              >
                {hour}
              </button>
              <span>:</span>
              <button
                type="button"
                onClick={() => setClockMode('minute')}
                className={cn('transition-opacity', clockMode !== 'minute' && 'opacity-60')}
              >
                {minute.toString().padStart(2, '0')}
              </button>
            </p>
            <div className="flex flex-col gap-0.5 text-xs font-bold">
              <button
                type="button"
                onClick={() => selectAmpm('AM')}
                className={cn('transition-opacity', ampm !== 'AM' && 'opacity-50')}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => selectAmpm('PM')}
                className={cn('transition-opacity', ampm !== 'PM' && 'opacity-50')}
              >
                PM
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-4 pt-3 pb-1">
        {activeTab === 'date' ? (
          <>
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => setViewDate(subMonths(viewDate, 1))}
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold">{format(viewDate, 'MMMM yyyy')}</span>
              <button
                type="button"
                onClick={() => setViewDate(addMonths(viewDate, 1))}
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Day-of-week headers — Monday start */}
            <div className="grid grid-cols-7 text-center mb-1">
              {DAY_HEADERS.map((d, i) => (
                <span key={`${d}-${i}`} className="text-xs text-muted-foreground py-1">{d}</span>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px">
              {calendarDays.map((day) => {
                const isSelected = isSameDay(day, selectedDate)
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      'h-9 w-full rounded-full text-xs flex items-center justify-center transition-colors',
                      !isSameMonth(day, viewDate) && 'opacity-30',
                      isToday(day) && !isSelected && 'border border-brand/50',
                      isSelected
                        ? 'bg-brand text-white font-semibold'
                        : 'hover:bg-accent'
                    )}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>

            {/* Quick shortcuts */}
            <div className="flex items-center gap-1.5 mt-3">
              {[
                { label: 'Today', date: today },
                { label: 'Tomorrow', date: addDays(today, 1) },
                { label: 'Next Mon', date: nextMonday(today) },
              ].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => { setLocalDate(format(s.date, 'yyyy-MM-dd')); setViewDate(s.date) }}
                  className="flex-1 h-8 rounded-lg border border-border text-xs text-muted-foreground hover:border-ring transition-colors"
                >
                  {s.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { onChange({}); onClose() }}
                aria-label="Clear date"
                className="w-8 h-8 rounded-lg border border-border text-muted-foreground hover:border-destructive hover:text-destructive transition-colors flex items-center justify-center"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* No-time toggle — store the date only */}
            <button
              type="button"
              onClick={() => setTimeSet((v) => !v)}
              className={cn(
                'w-full mt-2 h-8 rounded-lg border text-xs transition-colors',
                timeSet
                  ? 'border-border text-muted-foreground hover:border-ring'
                  : 'border-brand/50 text-brand bg-brand-tint'
              )}
            >
              {timeSet ? 'Remove time (date only)' : 'No time · date only'}
            </button>
          </>
        ) : (
          /* Analog clock face — tap or drag a number to set hour, then minute */
          <div
            ref={faceRef}
            onPointerDown={handleFacePointerDown}
            onPointerMove={handleFacePointerMove}
            onPointerUp={handleFacePointerUp}
            className="relative w-60 h-60 mx-auto my-2 rounded-full bg-muted/40 touch-none select-none"
          >
            {/* Hand */}
            <div
              className="absolute left-1/2 top-1/2 bg-brand rounded-full origin-top pointer-events-none"
              style={{
                width: '2px',
                height: `${HAND_LENGTH}px`,
                transform: `translateX(-50%) rotate(${handAngleDeg}deg)`,
              }}
            />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-brand pointer-events-none" />

            {/* Face numbers */}
            {faceItems.map((n, i) => {
              const angle = (i / 12) * 2 * Math.PI
              const x = Math.sin(angle) * FACE_RADIUS
              const y = -Math.cos(angle) * FACE_RADIUS
              const isSelected = clockMode === 'hour' ? hour === n : minute === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => (clockMode === 'hour' ? selectHour(n) : selectMinute(n))}
                  style={{ left: `calc(50% + ${x}px)`, top: `calc(50% + ${y}px)` }}
                  className={cn(
                    'absolute -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                    isSelected ? 'bg-brand text-white' : 'text-foreground hover:bg-accent'
                  )}
                  aria-label={clockMode === 'hour' ? `${n} o'clock` : `${n} minutes`}
                >
                  {clockMode === 'minute' ? n.toString().padStart(2, '0') : n}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex justify-end gap-4 px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-bold uppercase tracking-wide text-brand"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="text-xs font-bold uppercase tracking-wide text-brand"
        >
          Save
        </button>
      </div>
    </div>
  )
}
