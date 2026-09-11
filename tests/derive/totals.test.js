import { describe, expect, it } from 'vitest'
import { monthRange } from '../../src/lib/dates.js'
import { accountBalances, budgetProgress, totalCashPosition, totalsForRange, upcomingObligations } from '../../src/lib/derive/totals.js'

const transactions = [
  { date: '2026-09-05', type: 'income', ledger: 'income', amount: 5000, paymentMethod: 'Mashreq Debit 9437' },
  { date: '2026-09-06', type: 'expense', ledger: 'personal', amount: 200, category: 'Food (Groceries)', paymentMethod: 'Mashreq Debit 9437' },
  { date: '2026-09-07', type: 'refund', ledger: 'personal', amount: 50, category: 'Food (Groceries)', paymentMethod: 'Mashreq Debit 9437' },
  { date: '2026-09-08', type: 'expense', ledger: 'business', amount: 300, paymentMethod: 'Mashreq Credit 8777' },
  { date: '2026-09-09', type: 'expense', ledger: 'lh_business', amount: 100, paymentMethod: 'RAK Bank' },
  { date: '2026-09-10', type: 'transfer', ledger: 'personal', amount: 1000, paymentMethod: 'Mashreq Transfer' },
  { date: '2026-08-01', type: 'income', ledger: 'income', amount: 9999, paymentMethod: 'Mashreq Debit 9437' } // outside range
]

describe('totalsForRange', () => {
  it('sums income, and nets refunds against expense per ledger group, excluding transfers', () => {
    const result = totalsForRange(transactions, monthRange('2026-09'))
    expect(result.income).toBe(5000)
    expect(result.personalExpense).toBe(150) // 200 - 50 refund
    expect(result.businessExpense).toBe(400) // 300 (business) + 100 (lh_business)
    expect(result.net).toBe(4450) // 5000 - 150 - 400
  })
})

describe('accountBalances / totalCashPosition', () => {
  const accounts = [
    { name: 'Mashreq Debit 9437', openingBalance: 1000 },
    { name: 'Mashreq Credit 8777', openingBalance: 0 },
    { name: 'RAK Bank', openingBalance: 500 }
  ]

  it('adds income/refund credits and subtracts expense debits per account, excluding transfers', () => {
    const balances = accountBalances(accounts, transactions)
    // Mashreq Debit 9437: 1000 + 5000 (income) - 200 (expense) + 50 (refund) + 9999 (income, other month) = 15849
    expect(balances[0].balance).toBe(15849)
    expect(balances[1].balance).toBe(-300)
    expect(balances[2].balance).toBe(400)
  })

  it('sums every account balance for the total cash position', () => {
    expect(totalCashPosition(accounts, transactions)).toBe(15849 - 300 + 400)
  })
})

describe('upcomingObligations', () => {
  it('includes subscriptions due within the window, debt minimums, and the rent reserve, soonest-dated first', () => {
    const subscriptions = [
      { active: true, name: 'Spotify', amount: 24, nextDue: '2026-09-15' },
      { active: true, name: 'Too far', amount: 10, nextDue: '2026-12-01' },
      { active: false, name: 'Inactive', amount: 10, nextDue: '2026-09-12' }
    ]
    const debts = [{ status: 'active', name: 'ENBD', monthlyMin: 500 }, { status: 'settled', name: 'Old', monthlyMin: 100 }]
    const settings = { rent: 12500, rentCycleMonths: 3 }

    const items = upcomingObligations(subscriptions, debts, settings, { today: '2026-09-11', days: 14 })
    expect(items.map((i) => i.label)).toEqual(['Spotify', 'ENBD — minimum', 'Rent reserve'])
  })
})

describe('budgetProgress', () => {
  it('computes spend and percent-of-budget only for categories with a budget set', () => {
    const categories = [
      { name: 'Food (Groceries)', budget: 500, archived: false },
      { name: 'No Budget', budget: null, archived: false }
    ]
    const result = budgetProgress(categories, transactions, monthRange('2026-09'))
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ spent: 200, budget: 500, pct: 40 })
  })
})
