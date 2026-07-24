import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, render, cleanup, within } from '@testing-library/react'
import { DateTimePicker } from './DateTimePicker'

afterEach(cleanup)

describe('DateTimePicker', () => {
  it('hides time in date-only mode and returns hasTime=false', () => {
    const onSave = vi.fn()
    const onCancel = vi.fn()
    const { container } = render(
      <DateTimePicker
        initialDate={new Date('2026-06-23T12:00:00Z')}
        mode="date"
        onSave={onSave}
        onCancel={onCancel}
      />,
    )
    const view = within(container)
    expect(view.queryByText('Add time')).toBeNull()
    fireEvent.click(view.getByRole('button', { name: /save/i }))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toBeInstanceOf(Date)
    expect(onSave.mock.calls[0][1]).toBe(false)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('shows "Add time" toggle when no initial time set', () => {
    const onSave = vi.fn()
    const { container } = render(
      <DateTimePicker
        initialDate={new Date('2026-06-23')}
        hasInitialTime={false}
        mode="datetime"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )
    const view = within(container)
    expect(view.getByText('Add time')).toBeTruthy()
    fireEvent.click(view.getByRole('button', { name: /save/i }))
    expect(onSave.mock.calls[0][1]).toBe(false)
  })

  it('starts with time open when hasInitialTime=true and returns hasTime=true', () => {
    const onSave = vi.fn()
    const { container } = render(
      <DateTimePicker
        initialDate={new Date('2026-06-23T10:30:00')}
        hasInitialTime={true}
        mode="datetime"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )
    const view = within(container)
    expect(view.queryByText('Add time')).toBeNull()
    fireEvent.click(view.getByRole('button', { name: /save/i }))
    expect(onSave.mock.calls[0][1]).toBe(true)
  })
})
