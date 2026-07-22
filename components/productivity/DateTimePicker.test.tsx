import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DateTimePicker } from './DateTimePicker'

describe('DateTimePicker', () => {
  it('hides the time tab in date-only mode and returns a date payload', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()

    render(
      <DateTimePicker
        initialDate={new Date('2026-06-23T12:00:00Z')}
        mode="date"
        onSave={onSave}
        onCancel={onCancel}
      />,
    )

    expect(screen.queryByRole('button', { name: /time/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toBeInstanceOf(Date)
    expect(onCancel).not.toHaveBeenCalled()
  })
})
