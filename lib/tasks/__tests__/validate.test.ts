import { describe, it, expect } from 'vitest'
import {
  validateTask,
  TITLE_MAX,
  EST_TIME_MAX,
  REMINDERS_MAX,
  LABELS_MAX,
} from '../validate'

describe('validateTask', () => {
  it('accepts a minimal valid draft (title only)', () => {
    expect(validateTask({ title: 'Do the thing' })).toEqual({ valid: true, errors: {} })
  })

  describe('title', () => {
    it('rejects blank / whitespace-only titles', () => {
      expect(validateTask({ title: '' }).errors.title).toBeDefined()
      expect(validateTask({ title: '   ' }).errors.title).toBeDefined()
      expect(validateTask({ title: null }).errors.title).toBeDefined()
      expect(validateTask({}).errors.title).toBeDefined()
    })

    it('accepts titles at the max length', () => {
      expect(validateTask({ title: 'a'.repeat(TITLE_MAX) }).valid).toBe(true)
    })

    it('rejects titles over the max length', () => {
      expect(validateTask({ title: 'a'.repeat(TITLE_MAX + 1) }).errors.title).toBeDefined()
    })
  })

  describe('due_time / recurrence require a due_date', () => {
    it('flags a time with no date', () => {
      expect(validateTask({ title: 'x', due_time: '09:00' }).errors.due_time).toBeDefined()
    })

    it('allows a time when a date is present', () => {
      expect(validateTask({ title: 'x', due_date: '2026-07-20', due_time: '09:00' }).valid).toBe(true)
    })

    it('flags a repeat with no date', () => {
      expect(validateTask({ title: 'x', recurrence: 'FREQ=DAILY' }).errors.recurrence).toBeDefined()
    })

    it('allows a repeat when a date is present', () => {
      expect(validateTask({ title: 'x', due_date: '2026-07-20', recurrence: 'FREQ=DAILY' }).valid).toBe(true)
    })
  })

  describe('estimated_time', () => {
    it('accepts null and valid integers', () => {
      expect(validateTask({ title: 'x', estimated_time: null }).valid).toBe(true)
      expect(validateTask({ title: 'x', estimated_time: 90 }).valid).toBe(true)
      expect(validateTask({ title: 'x', estimated_time: EST_TIME_MAX }).valid).toBe(true)
    })

    it('rejects non-positive, non-integer, and over-max values', () => {
      expect(validateTask({ title: 'x', estimated_time: 0 }).errors.estimated_time).toBeDefined()
      expect(validateTask({ title: 'x', estimated_time: -5 }).errors.estimated_time).toBeDefined()
      expect(validateTask({ title: 'x', estimated_time: 12.5 }).errors.estimated_time).toBeDefined()
      expect(validateTask({ title: 'x', estimated_time: EST_TIME_MAX + 1 }).errors.estimated_time).toBeDefined()
    })
  })

  describe('collection caps', () => {
    it('rejects more than the max reminders', () => {
      const reminders = Array.from({ length: REMINDERS_MAX + 1 }, (_, i) => ({ id: String(i) }))
      expect(validateTask({ title: 'x', reminders }).errors.reminders).toBeDefined()
      expect(validateTask({ title: 'x', reminders: reminders.slice(0, REMINDERS_MAX) }).valid).toBe(true)
    })

    it('rejects more than the max labels', () => {
      const labels = Array.from({ length: LABELS_MAX + 1 }, (_, i) => `l${i}`)
      expect(validateTask({ title: 'x', labels }).errors.labels).toBeDefined()
      expect(validateTask({ title: 'x', labels: labels.slice(0, LABELS_MAX) }).valid).toBe(true)
    })
  })

  it('reports multiple errors at once', () => {
    const res = validateTask({ title: '', due_time: '09:00', estimated_time: 99999 })
    expect(res.valid).toBe(false)
    expect(Object.keys(res.errors).sort()).toEqual(['due_time', 'estimated_time', 'title'])
  })
})
