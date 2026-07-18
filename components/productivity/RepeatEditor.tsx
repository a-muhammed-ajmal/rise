'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  parseRule,
  formatRule,
  weekdayOf,
  WEEKDAYS,
  type Frequency,
  type Weekday,
  type RecurrenceSpec,
} from '@/lib/recurrence'

interface RepeatEditorProps {
  /** Current RRULE string, or null. */
  value: string | null
  /** Due date ('YYYY-MM-DD') used to seed the weekly weekday + "on" end date. */
  dueDate?: string | null
  onChange: (rule: string | null) => void
  onClose: () => void
}

type EndMode = 'never' | 'on' | 'after'

const WEEKDAY_INITIAL: Record<Weekday, string> = {
  MO: 'M', TU: 'T', WE: 'W', TH: 'T', FR: 'F', SA: 'S', SU: 'S',
}

const UNIT_BY_FREQ: Record<Frequency, string> = {
  DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year',
}

const WEEKDAYS_MF: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR']

type Preset = { key: string; label: string; build: (seedDay: Weekday) => RecurrenceSpec | null }

const PRESETS: Preset[] = [
  { key: 'none', label: 'None', build: () => null },
  { key: 'daily', label: 'Daily', build: () => ({ freq: 'DAILY', interval: 1, byday: [], until: null, count: null }) },
  { key: 'weekdays', label: 'Weekdays', build: () => ({ freq: 'WEEKLY', interval: 1, byday: [...WEEKDAYS_MF], until: null, count: null }) },
  { key: 'weekly', label: 'Weekly', build: (d) => ({ freq: 'WEEKLY', interval: 1, byday: [d], until: null, count: null }) },
  { key: 'biweekly', label: 'Bi-weekly', build: (d) => ({ freq: 'WEEKLY', interval: 2, byday: [d], until: null, count: null }) },
  { key: 'monthly', label: 'Monthly', build: () => ({ freq: 'MONTHLY', interval: 1, byday: [], until: null, count: null }) },
  { key: 'yearly', label: 'Yearly', build: () => ({ freq: 'YEARLY', interval: 1, byday: [], until: null, count: null }) },
]

export function RepeatEditor({ value, dueDate, onChange, onClose }: RepeatEditorProps) {
  const seedDay: Weekday = dueDate ? weekdayOf(dueDate) : 'MO'
  const initial = parseRule(value)

  const [freq, setFreq] = useState<Frequency>(initial?.freq ?? 'WEEKLY')
  const [interval, setInterval] = useState<number>(initial?.interval ?? 1)
  const [byday, setByday] = useState<Weekday[]>(
    initial?.byday.length ? initial.byday : freq === 'WEEKLY' ? [seedDay] : []
  )
  const [active, setActive] = useState<boolean>(!!initial)
  const [endMode, setEndMode] = useState<EndMode>(
    initial?.until ? 'on' : initial?.count != null ? 'after' : 'never'
  )
  const [untilDate, setUntilDate] = useState<string>(initial?.until ?? dueDate ?? '')
  const [count, setCount] = useState<number>(initial?.count ?? 13)

  function applyPreset(p: Preset) {
    const spec = p.build(seedDay)
    if (!spec) { setActive(false); return }
    setActive(true)
    setFreq(spec.freq)
    setInterval(spec.interval)
    setByday(spec.byday)
  }

  function toggleDay(d: Weekday) {
    setByday((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
  }

  function buildSpec(): RecurrenceSpec | null {
    if (!active) return null
    const days = freq === 'WEEKLY' && byday.length === 0 ? [seedDay] : byday
    return {
      freq,
      interval: Math.max(1, interval),
      byday: freq === 'WEEKLY' ? days : [],
      until: endMode === 'on' && untilDate ? untilDate : null,
      count: endMode === 'after' ? Math.max(1, count) : null,
    }
  }

  function handleDone() {
    const spec = buildSpec()
    onChange(spec ? formatRule(spec) : null)
    onClose()
  }

  // Which preset chip is highlighted.
  const activePresetKey = !active
    ? 'none'
    : freq === 'WEEKLY' && interval === 1 && byday.length === 5 && WEEKDAYS_MF.every((d) => byday.includes(d))
      ? 'weekdays'
      : freq === 'WEEKLY' && interval === 2
        ? 'biweekly'
        : freq === 'WEEKLY' && interval === 1
          ? 'weekly'
          : freq === 'DAILY' && interval === 1
            ? 'daily'
            : freq === 'MONTHLY' && interval === 1
              ? 'monthly'
              : freq === 'YEARLY' && interval === 1
                ? 'yearly'
                : 'custom'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Repeat settings"
      className="bg-popover rounded-2xl shadow-popup ring-1 ring-foreground/10 w-80 overflow-hidden"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <span className="text-sm font-semibold">Repeats</span>
        <button type="button" onClick={handleDone} className="text-xs font-bold uppercase tracking-wide text-brand">
          Done
        </button>
      </div>

      <div className="px-4 py-3 space-y-4 max-h-[60vh] overflow-y-auto">
        {/* Presets */}
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => applyPreset(p)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs border transition-colors',
                activePresetKey === p.key
                  ? 'border-brand/50 text-brand bg-brand-tint'
                  : 'border-border text-muted-foreground hover:border-ring'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        {active && (
          <>
            {/* Every N unit */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Every</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={interval}
                  onChange={(e) => setInterval(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  aria-label="Interval"
                  className="w-16 h-9 rounded-lg border border-input px-2 text-sm text-center outline-none focus:border-ring"
                />
                <select
                  value={freq}
                  onChange={(e) => setFreq(e.target.value as Frequency)}
                  aria-label="Frequency unit"
                  className="flex-1 h-9 rounded-lg border border-input px-2 text-sm outline-none focus:border-ring bg-transparent"
                >
                  {(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as Frequency[]).map((f) => (
                    <option key={f} value={f}>
                      {UNIT_BY_FREQ[f]}{interval > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Weekday pills */}
            {freq === 'WEEKLY' && (
              <div className="flex justify-between gap-1">
                {WEEKDAYS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    aria-label={d}
                    aria-pressed={byday.includes(d)}
                    className={cn(
                      'w-8 h-8 rounded-full text-xs flex items-center justify-center border transition-colors',
                      byday.includes(d)
                        ? 'border-brand bg-brand text-white'
                        : 'border-border text-muted-foreground hover:border-ring'
                    )}
                  >
                    {WEEKDAY_INITIAL[d]}
                  </button>
                ))}
              </div>
            )}

            {/* Ends */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Ends</p>
              <div className="space-y-1">
                <label className="flex items-center gap-2 py-1.5 cursor-pointer">
                  <input type="radio" name="endMode" checked={endMode === 'never'} onChange={() => setEndMode('never')} className="accent-brand" />
                  <span className="text-sm flex-1">Never</span>
                </label>
                <label className="flex items-center gap-2 py-1.5 cursor-pointer">
                  <input type="radio" name="endMode" checked={endMode === 'on'} onChange={() => setEndMode('on')} className="accent-brand" />
                  <span className="text-sm">On</span>
                  <input
                    type="date"
                    value={untilDate}
                    onChange={(e) => { setUntilDate(e.target.value); setEndMode('on') }}
                    aria-label="End date"
                    className="ml-auto h-8 rounded-md border border-input px-2 text-xs outline-none focus:border-ring bg-transparent"
                  />
                </label>
                <label className="flex items-center gap-2 py-1.5 cursor-pointer">
                  <input type="radio" name="endMode" checked={endMode === 'after'} onChange={() => setEndMode('after')} className="accent-brand" />
                  <span className="text-sm">After</span>
                  <span className="ml-auto flex items-center gap-1.5">
                    <input
                      type="number"
                      min={1}
                      value={count}
                      onChange={(e) => { setCount(Math.max(1, parseInt(e.target.value, 10) || 1)); setEndMode('after') }}
                      aria-label="Occurrence count"
                      className="w-14 h-8 rounded-md border border-input px-2 text-xs text-center outline-none focus:border-ring"
                    />
                    <span className="text-xs text-muted-foreground">times</span>
                  </span>
                </label>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
