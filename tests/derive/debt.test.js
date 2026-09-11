import { describe, expect, it } from 'vitest'
import { multiDebtProjection, payoffProjection } from '../../src/lib/derive/debt.js'

describe('payoffProjection', () => {
  it('pays off an interest-free debt in exactly balance/payment months', () => {
    const result = payoffProjection({ remaining: 1200, monthlyMin: 100, interest: 0 }, { today: '2026-09-11' })
    expect(result).toEqual({ months: 12, totalInterest: 0, payoffDate: '2027-09-11', payable: true })
  })

  it('is already payable with zero months when remaining is 0', () => {
    expect(payoffProjection({ remaining: 0, monthlyMin: 100, interest: 0 }, { today: '2026-09-11' })).toEqual({
      months: 0,
      totalInterest: 0,
      payoffDate: '2026-09-11',
      payable: true
    })
  })

  it('is unpayable when there is no payment at all', () => {
    expect(payoffProjection({ remaining: 500, monthlyMin: 0, interest: 0 })).toEqual({
      months: Infinity,
      totalInterest: Infinity,
      payoffDate: null,
      payable: false
    })
  })

  it('is unpayable when the payment does not even cover monthly interest', () => {
    const result = payoffProjection({ remaining: 1000, monthlyMin: 10, interest: 100 })
    expect(result.payable).toBe(false)
    expect(result.months).toBe(Infinity)
  })

  it('accrues real interest for a nonzero rate (months and interest both increase vs 0%)', () => {
    const withInterest = payoffProjection({ remaining: 1000, monthlyMin: 100, interest: 12 })
    const withoutInterest = payoffProjection({ remaining: 1000, monthlyMin: 100, interest: 0 })
    expect(withInterest.months).toBeGreaterThanOrEqual(withoutInterest.months)
    expect(withInterest.totalInterest).toBeGreaterThan(0)
    expect(withInterest.payable).toBe(true)
  })
})

describe('multiDebtProjection', () => {
  it('pays off two interest-free debts, each from its own minimum, in the expected month', () => {
    const debts = [
      { id: 'a', remaining: 600, monthlyMin: 100, interest: 0 },
      { id: 'b', remaining: 300, monthlyMin: 50, interest: 0 }
    ]
    const result = multiDebtProjection(debts, { extraMonthly: 0, strategy: 'avalanche', today: '2026-09-11' })
    expect(result.months).toBe(6)
    expect(result.totalInterest).toBe(0)
    expect(result.order.every((entry) => entry.payoffMonth === 6)).toBe(true)
  })

  it('records a debt paid off early via its own minimum, not the overall total months (regression)', () => {
    const debts = [
      { id: 'a', remaining: 50, monthlyMin: 50, interest: 0 },
      { id: 'b', remaining: 600, monthlyMin: 50, interest: 0 }
    ]
    const result = multiDebtProjection(debts, { extraMonthly: 0, strategy: 'avalanche' })
    const a = result.order.find((entry) => entry.id === 'a')
    const b = result.order.find((entry) => entry.id === 'b')
    expect(a.payoffMonth).toBe(1)
    expect(b.payoffMonth).toBe(result.months)
    expect(result.months).toBeGreaterThan(1)
  })

  it('orders by highest interest first for avalanche, smallest balance first for snowball', () => {
    const debts = [
      { id: 'low-interest-big', remaining: 5000, monthlyMin: 100, interest: 5 },
      { id: 'high-interest-small', remaining: 500, monthlyMin: 100, interest: 25 }
    ]
    const avalanche = multiDebtProjection(debts, { strategy: 'avalanche' })
    expect(avalanche.order[0].id).toBe('high-interest-small')

    const snowball = multiDebtProjection(debts, { strategy: 'snowball' })
    expect(snowball.order[0].id).toBe('high-interest-small') // also the smaller balance here
  })

  it('returns zero months when every debt is already settled or paid off', () => {
    const debts = [{ id: 'a', remaining: 0, monthlyMin: 100, interest: 0, status: 'settled' }]
    expect(multiDebtProjection(debts, { today: '2026-09-11' })).toEqual({
      months: 0,
      totalInterest: 0,
      payoffDate: '2026-09-11',
      order: []
    })
  })
})
