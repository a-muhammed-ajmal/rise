'use client'

import { useState, useMemo } from 'react'
import {
  format, parseISO, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval,
  isSameDay, isSameMonth, isToday,
  addMonths, subMonths, addDays, nextMonday,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
  return ([0, 15, 30, 45] as const).reduce((p, c) =>
    Math.abs(c - m) < Math.abs(p - m) ? c : p
  )
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

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// ─── Component ────────────────────────────────────────────────────────────────

export function DateTimePicker({ value, onChange, onClose }: DateTimePickerProps) {
  const today = new Date()

  const [viewDate, setViewDate] = useState<Date>(() =>
    value.date ? parseISO(value.date) : today
  )
  const [localDate, setLocalDate] = useState<string | undefined>(value.date)
  const [noTime, setNoTime] = useState<boolean>(!value.time)
  const [hour, setHour] = useState<number>(() => deriveHour(value.time))
  const [minute, setMinute] = useState<number>(() => deriveMinute(value.time))
  const [ampm, setAmpm] = useState<'AM' | 'PM'>(() => deriveAmPm(value.time))

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(viewDate), { weekStartsOn: 0 })
    const end   = endOfWeek(endOfMonth(viewDate), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [viewDate])

  function handleDayClick(day: Date) {
    setLocalDate(format(day, 'yyyy-MM-dd'))
  }

  function handleTodayShortcut() {
    setLocalDate(format(today, 'yyyy-MM-dd'))
    setViewDate(today)
  }

  function handleTomorrowShortcut() {
    const t = addDays(today, 1)
    setLocalDate(format(t, 'yyyy-MM-dd'))
    setViewDate(t)
  }

  function handleNextMondayShortcut() {
    const nm = nextMonday(today)
    setLocalDate(format(nm, 'yyyy-MM-dd'))
    setViewDate(nm)
  }

  function handleDone() {
    onChange({
      date: localDate,
      time: noTime || !localDate ? undefined : to24h(hour, minute, ampm),
    })
    onClose()
  }

  function handleClear() {
    setLocalDate(undefined)
    onChange({ date: undefined, time: undefined })
    onClose()
  }

  const selectedDate = localDate ? parseISO(localDate) : undefined

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose date and time"
      className="bg-popover rounded-xl shadow-xl ring-1 ring-foreground/10 p-3 w-72"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
    >
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

      {/* Day-of-week headers — Sunday start */}
      <div className="grid grid-cols-7 text-center mb-1">
        {DAY_HEADERS.map((d) => (
          <span key={d} className="text-xs text-muted-foreground py-1">{d}</span>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px">
        {calendarDays.map((day) => {
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => handleDayClick(day)}
              className={cn(
                'h-8 w-full rounded-md text-xs flex items-center justify-center transition-colors',
                !isSameMonth(day, viewDate) && 'opacity-30',
                isToday(day) && !isSelected && 'border border-primary/50',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              )}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>

      {/* Quick shortcuts */}
      <div className="border-t my-2 pt-2 flex gap-1.5">
        <button
          type="button"
          onClick={handleTodayShortcut}
          className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-accent transition-colors"
        >
          Today
        </button>
        <button
          type="button"
          onClick={handleTomorrowShortcut}
          className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-accent transition-colors"
        >
          Tomorrow
        </button>
        <button
          type="button"
          onClick={handleNextMondayShortcut}
          className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-accent transition-colors"
        >
          Next Mon
        </button>
      </div>

      {/* Time section */}
      <div className="border-t mt-2 pt-2 space-y-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={!noTime}
            onChange={(e) => setNoTime(!e.target.checked)}
            className="rounded"
          />
          Include time
        </label>

        {!noTime && (
          <div className="flex items-center gap-1.5">
            <Select value={String(hour)} onValueChange={(v) => { if (v !== null) setHour(parseInt(v, 10)) }}>
              <SelectTrigger className="h-7 w-14 text-xs px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                  <SelectItem key={h} value={String(h)} className="text-xs">{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground text-sm">:</span>

            <Select value={String(minute)} onValueChange={(v) => { if (v !== null) setMinute(parseInt(v, 10)) }}>
              <SelectTrigger className="h-7 w-14 text-xs px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 15, 30, 45].map((m) => (
                  <SelectItem key={m} value={String(m)} className="text-xs">
                    {m.toString().padStart(2, '0')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* AM/PM toggle */}
            <div className="flex rounded-md border overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setAmpm('AM')}
                className={cn(
                  'px-2 py-1 transition-colors',
                  ampm === 'AM' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                )}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => setAmpm('PM')}
                className={cn(
                  'px-2 py-1 transition-colors',
                  ampm === 'PM' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                )}
              >
                PM
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex justify-between mt-3 pt-2 border-t">
        <button
          type="button"
          onClick={handleClear}
          className="text-xs px-3 py-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground"
        >
          Clear Date
        </button>
        <button
          type="button"
          onClick={handleDone}
          disabled={!localDate}
          className="text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Done
        </button>
      </div>
    </div>
  )
}
