import { describe, it, expect } from 'vitest'
import {
  parseRule,
  formatRule,
  describeRecurrence,
  weekdayOf,
  nextDueDate,
  decrementCount,
  WEEKDAYS,
  type RecurrenceSpec,
} from '../recurrence'

describe('parseRule', () => {
  it('returns null for empty / invalid input', () => {
    expect(parseRule(null)).toBeNull()
    expect(parseRule(undefined)).toBeNull()
    expect(parseRule('')).toBeNull()
    expect(parseRule('FREQ=HOURLY')).toBeNull()
    expect(parseRule('INTERVAL=2')).toBeNull()
  })

  it('parses a simple daily rule with defaults', () => {
    expect(parseRule('FREQ=DAILY')).toEqual({
      freq: 'DAILY', interval: 1, byday: [], until: null, count: null,
    })
  })

  it('parses interval, byday, until and count', () => {
    expect(parseRule('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;UNTIL=20261001;COUNT=13')).toEqual({
      freq: 'WEEKLY', interval: 2, byday: ['MO', 'WE'], until: '2026-10-01', count: 13,
    })
  })

  it('is case-insensitive and trims segments', () => {
    expect(parseRule('freq=weekly;byday=mo,fr')).toEqual({
      freq: 'WEEKLY', interval: 1, byday: ['MO', 'FR'], until: null, count: null,
    })
  })

  it('ignores bad interval / count values', () => {
    const spec = parseRule('FREQ=DAILY;INTERVAL=0;COUNT=-3')!
    expect(spec.interval).toBe(1)
    expect(spec.count).toBeNull()
  })

  it('drops unknown BYDAY tokens', () => {
    expect(parseRule('FREQ=WEEKLY;BYDAY=MO,XX,FR')!.byday).toEqual(['MO', 'FR'])
  })
})

describe('formatRule', () => {
  const base: RecurrenceSpec = { freq: 'WEEKLY', interval: 1, byday: [], until: null, count: null }

  it('omits interval when 1 and byday when empty', () => {
    expect(formatRule({ ...base, freq: 'DAILY' })).toBe('FREQ=DAILY')
  })

  it('emits byday in canonical Monday-first order', () => {
    expect(formatRule({ ...base, byday: ['WE', 'MO', 'FR'] })).toBe('FREQ=WEEKLY;BYDAY=MO,WE,FR')
  })

  it('serializes interval, until (compact) and count', () => {
    expect(formatRule({ freq: 'WEEKLY', interval: 2, byday: ['MO'], until: '2026-10-01', count: 5 }))
      .toBe('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;UNTIL=20261001;COUNT=5')
  })

  it('round-trips through parseRule', () => {
    const rule = 'FREQ=WEEKLY;INTERVAL=3;BYDAY=TU,TH;COUNT=8'
    expect(formatRule(parseRule(rule)!)).toBe(rule)
  })

  it('does not emit byday for non-weekly frequencies', () => {
    expect(formatRule({ freq: 'MONTHLY', interval: 1, byday: ['MO'], until: null, count: null }))
      .toBe('FREQ=MONTHLY')
  })
})

describe('describeRecurrence', () => {
  it('describes presets', () => {
    expect(describeRecurrence(null)).toBe('None')
    expect(describeRecurrence('FREQ=DAILY')).toBe('Daily')
    expect(describeRecurrence('FREQ=MONTHLY')).toBe('Monthly')
    expect(describeRecurrence('FREQ=YEARLY')).toBe('Yearly')
  })

  it('recognizes weekdays', () => {
    expect(describeRecurrence('FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR')).toBe('Weekdays')
  })

  it('lists selected weekly days', () => {
    expect(describeRecurrence('FREQ=WEEKLY;BYDAY=MO,WE')).toBe('Weekly on Mon, Wed')
  })

  it('describes intervals and end conditions', () => {
    expect(describeRecurrence('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO')).toBe('Every 2 weeks on Mon')
    expect(describeRecurrence('FREQ=DAILY;COUNT=5')).toBe('Daily · ends after 5')
    expect(describeRecurrence('FREQ=MONTHLY;UNTIL=20261231')).toBe('Monthly · until 2026-12-31')
  })
})

describe('weekdayOf', () => {
  it('maps ISO dates to weekdays', () => {
    // 2026-07-20 is a Monday.
    expect(weekdayOf('2026-07-20')).toBe('MO')
    expect(weekdayOf('2026-07-25')).toBe('SA')
    expect(weekdayOf('2026-07-26')).toBe('SU')
  })

  it('WEEKDAYS is Monday-first and complete', () => {
    expect(WEEKDAYS).toEqual(['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'])
  })
})

describe('nextDueDate', () => {
  it('returns null when not recurring', () => {
    expect(nextDueDate(null, '2026-07-20')).toBeNull()
  })

  it('advances daily by interval', () => {
    expect(nextDueDate('FREQ=DAILY', '2026-07-20')).toBe('2026-07-21')
    expect(nextDueDate('FREQ=DAILY;INTERVAL=3', '2026-07-20')).toBe('2026-07-23')
  })

  it('advances weekly without byday', () => {
    expect(nextDueDate('FREQ=WEEKLY', '2026-07-20')).toBe('2026-07-27')
  })

  it('finds the next byday within the same week', () => {
    // From Mon 2026-07-20, weekly Mon/Wed → Wed 2026-07-22.
    expect(nextDueDate('FREQ=WEEKLY;BYDAY=MO,WE', '2026-07-20')).toBe('2026-07-22')
  })

  it('rolls to the next matching weekday across weeks', () => {
    // From Wed 2026-07-22, weekly Mon/Wed → next Mon 2026-07-27.
    expect(nextDueDate('FREQ=WEEKLY;BYDAY=MO,WE', '2026-07-22')).toBe('2026-07-27')
  })

  it('honors interval for bi-weekly byday', () => {
    // From Wed 2026-07-22, bi-weekly Mon/Wed → skip the following week → Mon 2026-08-03.
    expect(nextDueDate('FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE', '2026-07-22')).toBe('2026-08-03')
  })

  it('advances monthly and yearly', () => {
    expect(nextDueDate('FREQ=MONTHLY', '2026-07-20')).toBe('2026-08-20')
    expect(nextDueDate('FREQ=YEARLY', '2026-07-20')).toBe('2027-07-20')
  })

  it('returns null once past UNTIL', () => {
    expect(nextDueDate('FREQ=DAILY;UNTIL=20260720', '2026-07-20')).toBeNull()
    expect(nextDueDate('FREQ=DAILY;UNTIL=20260725', '2026-07-20')).toBe('2026-07-21')
  })
})

describe('decrementCount', () => {
  it('returns null for non-recurring input', () => {
    expect(decrementCount(null)).toBeNull()
  })

  it('leaves unbounded rules unchanged', () => {
    expect(decrementCount('FREQ=DAILY')).toBe('FREQ=DAILY')
  })

  it('decrements a bounded count', () => {
    expect(decrementCount('FREQ=DAILY;COUNT=3')).toBe('FREQ=DAILY;COUNT=2')
  })

  it('returns null when the last occurrence is consumed', () => {
    expect(decrementCount('FREQ=DAILY;COUNT=1')).toBeNull()
  })
})
