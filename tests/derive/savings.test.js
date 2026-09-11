import { describe, expect, it } from 'vitest'
import { emergencyFundTarget, rentReserveMonthly, requiredMonthlyForGoal } from '../../src/lib/derive/savings.js'

describe('requiredMonthlyForGoal', () => {
  it('divides the remaining amount by the whole months until the target date', () => {
    const goal = { target: 12000, current: 2000, targetDate: '2027-01-11' }
    expect(requiredMonthlyForGoal(goal, '2026-09-11')).toBe(2500) // 10000 / 4 months
  })

  it('returns 0 once the goal is already met', () => {
    expect(requiredMonthlyForGoal({ target: 1000, current: 1000, targetDate: '2027-01-01' }, '2026-09-11')).toBe(0)
  })

  it('returns 0 when there is no target date', () => {
    expect(requiredMonthlyForGoal({ target: 1000, current: 0 }, '2026-09-11')).toBe(0)
  })
})

describe('rentReserveMonthly', () => {
  it('matches the brief\'s own example: 12,500 every 3 months = 4,166.67/month', () => {
    expect(rentReserveMonthly({ rent: 12500, rentCycleMonths: 3 })).toBe(4166.67)
  })
})

describe('emergencyFundTarget', () => {
  const transactions = [
    { date: '2026-06-05', type: 'expense', category: 'Food (Groceries)', amount: 1000 },
    { date: '2026-06-10', type: 'expense', category: 'Socializing', amount: 500 }, // not essential
    { date: '2026-07-05', type: 'expense', category: 'Utilities', amount: 800 },
    { date: '2026-08-05', type: 'expense', category: 'Rent', amount: 4166.67 },
    { date: '2026-09-05', type: 'expense', category: 'Food (Groceries)', amount: 9999 } // current month, excluded
  ]

  it('is 3x the average of the last 3 complete months of essential spend only', () => {
    // averages: Jun 1000, Jul 800, Aug 4166.67 -> avg 1988.89 -> x3 = 5966.67
    expect(emergencyFundTarget(transactions, { today: '2026-09-11' })).toBe(5966.67)
  })

  it('returns 0 when there is no essential spending history', () => {
    expect(emergencyFundTarget([], { today: '2026-09-11' })).toBe(0)
  })
})
