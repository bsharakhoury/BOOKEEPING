import { describe, expect, it } from 'vitest'
import { addDays, lastNMonthKeys, monthKeysInRange, monthRange, quarterRange, ytdRange } from '../src/lib/dates.js'

describe('addDays', () => {
  it('adds days, rolling over month boundaries', () => {
    expect(addDays('2026-08-28', 5)).toBe('2026-09-02')
  })
})

describe('monthRange', () => {
  it('covers the full calendar month, including leap-year February', () => {
    expect(monthRange('2026-09')).toEqual({ start: '2026-09-01', end: '2026-09-30' })
    expect(monthRange('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' })
  })
})

describe('quarterRange', () => {
  it('covers the calendar quarter containing the given month', () => {
    expect(quarterRange('2026-08')).toEqual({ start: '2026-07-01', end: '2026-09-30' })
    expect(quarterRange('2026-01')).toEqual({ start: '2026-01-01', end: '2026-03-31' })
    expect(quarterRange('2026-12')).toEqual({ start: '2026-10-01', end: '2026-12-31' })
  })
})

describe('ytdRange', () => {
  it('runs from Jan 1 through the end of the given month', () => {
    expect(ytdRange('2026-09')).toEqual({ start: '2026-01-01', end: '2026-09-30' })
  })
})

describe('monthKeysInRange', () => {
  it('lists every month from start to end inclusive, rolling across a year boundary', () => {
    expect(monthKeysInRange('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
  })

  it('swaps out-of-order start/end', () => {
    expect(monthKeysInRange('2026-02', '2025-12')).toEqual(['2025-12', '2026-01', '2026-02'])
  })

  it('returns a single month when start equals end', () => {
    expect(monthKeysInRange('2026-05', '2026-05')).toEqual(['2026-05'])
  })
})

describe('lastNMonthKeys', () => {
  it('returns the last N months ending with the current one, oldest first', () => {
    expect(lastNMonthKeys('2026-09-11', 3)).toEqual(['2026-07', '2026-08', '2026-09'])
  })

  it('rolls across a year boundary', () => {
    expect(lastNMonthKeys('2026-02-01', 3)).toEqual(['2025-12', '2026-01', '2026-02'])
  })
})
