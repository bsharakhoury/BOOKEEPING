import { describe, expect, it } from 'vitest'
import { periodDueDate, periodKeyForDate, periodLabel } from '../../src/data/vatPeriods.js'

describe('periodKeyForDate', () => {
  it('keys a normal (non-wrapping) period by its own year', () => {
    expect(periodKeyForDate('2026-03-15')).toBe('2026-mar-may')
    expect(periodKeyForDate('2026-08-31')).toBe('2026-jun-aug')
  })

  it('keys a December date in the wrapping Dec–Feb period by its own year', () => {
    expect(periodKeyForDate('2026-12-25')).toBe('2026-dec-feb')
  })

  it('keys a January/February date in the wrapping period by the PREVIOUS year (the period it started in)', () => {
    expect(periodKeyForDate('2027-01-10')).toBe('2026-dec-feb')
    expect(periodKeyForDate('2027-02-28')).toBe('2026-dec-feb')
  })
})

describe('periodDueDate', () => {
  it('matches the brief\'s own due dates for a normal period', () => {
    expect(periodDueDate('2026-mar-may')).toBe('2026-06-29')
    expect(periodDueDate('2026-jun-aug')).toBe('2026-09-28')
    expect(periodDueDate('2026-sep-nov')).toBe('2026-12-29')
  })

  it('rolls the due date into the next calendar year for the wrapping Dec–Feb period', () => {
    expect(periodDueDate('2026-dec-feb')).toBe('2027-03-29')
  })
})

describe('periodLabel', () => {
  it('labels a normal period with its single year', () => {
    expect(periodLabel('2026-mar-may')).toBe('Mar – May 2026')
  })

  it('labels a wrapping period spanning two years', () => {
    expect(periodLabel('2026-dec-feb')).toBe('Dec – Feb 2026/27')
  })
})
