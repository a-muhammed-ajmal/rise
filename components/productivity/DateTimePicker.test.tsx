import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, render, cleanup, within } from '@testing-library/react'
import { DateTimePicker } from './DateTimePicker'

afterEach(cleanup)

describe('DateTimePicker', () => {
  it('hides time in date-only mode and returns hasTime=false', () => {
    const onSave = vi.fn()
    const { container } = render(
      <DateTimePicker
        initialDate={new Date('2026-06-23T12:00:00Z')}
        mode="date"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )
    const view = within(container)
    expect(view.queryByText('Add time')).toBeNull()
    fireEvent.click(view.getByRole('button', { name: /save/i }))
    expect(onSave.mock.calls[0][0]).toBeInstanceOf(Date)
    expect(onSave.mock.calls[0][1]).toBe(false)
  })

  it('shows "Add time" toggle when hasInitialTime=false', () => {
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

  it('starts with time open when hasInitialTime=true', () => {
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

  it('can toggle time off with X and saves hasTime=false', () => {
    const onSave = vi.fn()
    const { container } = render(
      <DateTimePicker
        initialDate={new Date('2026-06-23T09:00:00')}
        hasInitialTime={true}
        mode="datetime"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )
    const view = within(container)
    fireEvent.click(view.getByRole('button', { name: /remove time/i }))
    expect(view.getByText('Add time')).toBeTruthy()
    fireEvent.click(view.getByRole('button', { name: /save/i }))
    expect(onSave.mock.calls[0][1]).toBe(false)
  })
})
