'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface DurationPickerProps {
  value: number // total minutes
  onChange: (minutes: number) => void
  onClose: () => void
}

export function DurationPicker({ value, onChange, onClose }: DurationPickerProps) {
  const [hours, setHours] = useState(() => Math.floor(value / 60))
  const [minutes, setMinutes] = useState(() => {
    const m = value % 60
    return Math.round(m / 5) * 5 % 60
  })

  const headerLabel = (() => {
    if (!hours && !minutes) return '—'
    const parts: string[] = []
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    return parts.join(' ')
  })()

  function adjustHours(delta: number) {
    setHours(h => Math.max(0, Math.min(23, h + delta)))
  }

  function adjustMinutes(delta: number) {
    setMinutes(m => {
      const next = m + delta * 5
      if (next < 0) return 55
      if (next >= 60) return 0
      return next
    })
  }

  function handleSave() {
    onChange(hours * 60 + minutes)
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Set duration"
      className="bg-popover rounded-2xl shadow-popup ring-1 ring-foreground/10 w-64 overflow-hidden"
      onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
    >
      {/* Header band — matches DateTimePicker style exactly */}
      <div className="bg-brand text-white px-4 py-4">
        <p className="text-xs text-white/70 font-medium uppercase tracking-wide">Duration</p>
        <p className="text-3xl font-bold mt-0.5">{headerLabel}</p>
      </div>

      {/* Hour / minute spinners */}
      <div className="flex items-start justify-center gap-6 px-4 py-5">
        {/* Hours */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => adjustHours(1)}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
            aria-label="Increase hours"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <span className="text-3xl font-bold tabular-nums w-12 text-center">
            {hours.toString().padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={() => adjustHours(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
            aria-label="Decrease hours"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <span className="text-xs text-muted-foreground font-medium mt-0.5">hours</span>
        </div>

        <span className="text-2xl font-bold text-muted-foreground mt-6">:</span>

        {/* Minutes */}
        <div className="flex flex-col items-center gap-1.5">
          <button
            type="button"
            onClick={() => adjustMinutes(1)}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
            aria-label="Increase minutes"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <span className="text-3xl font-bold tabular-nums w-12 text-center">
            {minutes.toString().padStart(2, '0')}
          </span>
          <button
            type="button"
            onClick={() => adjustMinutes(-1)}
            className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-accent transition-colors"
            aria-label="Decrease minutes"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <span className="text-xs text-muted-foreground font-medium mt-0.5">minutes</span>
        </div>
      </div>

      {/* Footer — matches DateTimePicker footer exactly */}
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
