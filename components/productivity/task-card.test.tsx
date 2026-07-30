import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, cleanup, within } from '@testing-library/react'
import { TaskCard } from './task-card'
import type { Task, ProjectCategory } from '@/lib/types/database'

afterEach(cleanup)

const baseTask: Task = {
  id: 'task-1',
  user_id: 'user-1',
  title: 'Renew trade licence',
  description: null,
  status: 'todo',
  priority: 'P3',
  due_date: null,
  due_time: null,
  completed_at: null,
  is_focus: false,
  focus_date: null,
  is_starred: false,
  labels: [],
  subtasks: [],
  attachments: [],
  recurrence: null,
  reminder: null,
  estimated_time: null,
  project_id: null,
  area: 'default',
  created_at: '2026-06-20T08:00:00Z',
  updated_at: '2026-06-20T08:00:00Z',
  is_completed: false,
}

const task = (over: Partial<Task> = {}): Task => ({ ...baseTask, ...over })

function renderCard(over: Partial<Task> = {}, props: Record<string, unknown> = {}) {
  const onComplete = vi.fn()
  const onOpenDetail = vi.fn()
  const utils = render(
    <TaskCard task={task(over)} onComplete={onComplete} onOpenDetail={onOpenDetail} {...props} />,
  )
  // The card is the outermost element rendered by the component.
  const card = utils.container.firstElementChild as HTMLElement
  return { ...utils, card, onComplete, onOpenDetail }
}

describe('TaskCard — area colors', () => {
  it('tints the card with the selected area and borders it with the area color', () => {
    const { card } = renderCard({ area: 'financial' })
    expect(card.style.backgroundColor).toBe('var(--area-financial-tint)')
    expect(card.style.borderLeftColor).toBe('var(--area-financial)')
  })

  it('gives visually distinct tints to financial and wellness', () => {
    const { card: financial } = renderCard({ area: 'financial' })
    const financialTint = financial.style.backgroundColor
    cleanup()
    const { card: wellness } = renderCard({ area: 'wellness' })
    expect(wellness.style.backgroundColor).not.toBe(financialTint)
  })

  it('leaves the base surface when no area is selected', () => {
    const { card } = renderCard({ area: 'default' })
    expect(card.style.backgroundColor).toBe('')
    expect(card.className).toContain('bg-card')
    // The area border still renders, in the neutral token.
    expect(card.style.borderLeftColor).toBe('var(--area-default)')
  })

  it('uses a distinct token for every area', () => {
    const areas: ProjectCategory[] = [
      'personal',
      'professional',
      'financial',
      'wellness',
      'relationship',
      'vision',
      'legal',
    ]
    const seen = areas.map((area) => {
      const { card } = renderCard({ area })
      const tint = card.style.backgroundColor
      cleanup()
      return tint
    })
    expect(new Set(seen).size).toBe(areas.length)
  })

  it('drops the tint on a completed task so the muted state reads clearly', () => {
    const { card } = renderCard({ area: 'financial', status: 'done' })
    expect(card.style.backgroundColor).toBe('')
    expect(card.className).toContain('opacity-60')
  })

  it('drops the tint while bulk-selected', () => {
    const { card } = renderCard({ area: 'legal' }, { bulkMode: true, selected: true })
    expect(card.style.backgroundColor).toBe('')
  })
})

describe('TaskCard — due date and time color', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-23T12:00:00Z')) // Dubai 16:00
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows an upcoming deadline in green', () => {
    const { card } = renderCard({ due_date: '2026-06-23', due_time: '19:00' })
    const meta = within(card).getByText(/Today/)
    expect(meta.style.color).toBe('var(--color-success)')
  })

  it('shows a passed deadline in red', () => {
    const { card } = renderCard({ due_date: '2026-06-23', due_time: '09:00' })
    const meta = within(card).getByText(/Today/)
    expect(meta.style.color).toBe('var(--color-danger)')
  })

  // Regression: Postgres returns `time` as "HH:MM:SS", which used to produce an
  // invalid Date and left every timed task permanently green.
  it('turns red for an overdue HH:MM:SS time from the database', () => {
    const { card } = renderCard({ due_date: '2026-06-22', due_time: '11:37:00' })
    const meta = within(card).getByText(/Yesterday/)
    expect(meta.style.color).toBe('var(--color-danger)')
  })

  it('stays green for an upcoming HH:MM:SS time from the database', () => {
    const { card } = renderCard({ due_date: '2026-06-23', due_time: '19:00:00' })
    const meta = within(card).getByText(/Today/)
    expect(meta.style.color).toBe('var(--color-success)')
  })

  it('renders the time in 12-hour form next to the date', () => {
    const { card } = renderCard({ due_date: '2026-06-23', due_time: '19:00:00' })
    expect(within(card).getByText('7:00 PM')).toBeTruthy()
  })

  it('falls back to the created date, uncolored, when there is no due date', () => {
    const { card } = renderCard({ due_date: null })
    const meta = within(card).getByText(/20\/06\/2026/)
    expect(meta.style.color).toBe('')
    expect(meta.className).toContain('text-muted-foreground')
  })
})

describe('TaskCard — project name', () => {
  it('shows the project name on the same row as the date, at the same size', () => {
    const { card } = renderCard(
      { due_date: '2026-06-23', project_id: 'p1' },
      { projectName: 'Trade Licence' },
    )
    const project = within(card).getByText('Trade Licence')
    const date = within(card).getByText(/Today|23\/06\/2026/)
    expect(project.className).toContain('text-xs')
    expect(date.className).toContain('text-xs')
    // Same flex row, so they sit left and right of each other.
    expect(project.parentElement).toBe(date.parentElement)
  })

  it('truncates a name longer than 15 characters with an ellipsis', () => {
    const { card } = renderCard({ project_id: 'p1' }, { projectName: 'Dubai Immigration Renewal' })
    expect(within(card).getByText('Dubai Immigrati...')).toBeTruthy()
  })

  it('leaves a 15-character name intact', () => {
    const { card } = renderCard({ project_id: 'p1' }, { projectName: 'Trade Licence A' })
    expect(within(card).getByText('Trade Licence A')).toBeTruthy()
  })

  it('keeps the full name in a title attribute for the truncated case', () => {
    const { card } = renderCard({ project_id: 'p1' }, { projectName: 'Dubai Immigration Renewal' })
    expect(within(card).getByText('Dubai Immigrati...').getAttribute('title')).toBe(
      'Dubai Immigration Renewal',
    )
  })

  it('renders nothing extra when the task has no project', () => {
    const { card } = renderCard({ due_date: '2026-06-23' })
    expect(within(card).queryByTitle(/./)).toBeNull()
  })

  it('never shows the area name — the tint carries it', () => {
    const { card } = renderCard({ area: 'financial' }, { projectName: 'Budget' })
    expect(within(card).queryByText(/financial/i)).toBeNull()
    expect(within(card).queryByText(/Financial/)).toBeNull()
  })
})

describe('TaskCard — interaction', () => {
  it('opens the detail popup when the content is clicked', () => {
    const { card, onOpenDetail } = renderCard()
    fireEvent.click(within(card).getByText('Renew trade licence'))
    expect(onOpenDetail).toHaveBeenCalledTimes(1)
  })

  it('completes the task from the checkbox', () => {
    const { card, onComplete } = renderCard()
    fireEvent.click(within(card).getByRole('button', { name: /complete task/i }))
    expect(onComplete).toHaveBeenCalledWith('task-1')
  })

  it('toggles bulk selection instead of completing in bulk mode', () => {
    const onToggleSelect = vi.fn()
    const { card, onComplete } = renderCard({}, { bulkMode: true, onToggleSelect })
    fireEvent.click(within(card).getByRole('button', { name: /select task/i }))
    expect(onToggleSelect).toHaveBeenCalledWith('task-1')
    expect(onComplete).not.toHaveBeenCalled()
  })
})
