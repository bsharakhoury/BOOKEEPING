import { describe, expect, it } from 'vitest'
import {
  advanceDueDate,
  annualCost,
  findPaymentForSubscription,
  priceChangeFlag,
  rollForwardDueDates
} from '../../src/lib/derive/subscriptions.js'

describe('advanceDueDate', () => {
  it('advances by the right number of months per frequency', () => {
    expect(advanceDueDate('2026-01-15', 'monthly')).toBe('2026-02-15')
    expect(advanceDueDate('2026-01-15', 'quarterly')).toBe('2026-04-15')
    expect(advanceDueDate('2026-01-15', 'biannual')).toBe('2026-07-15')
    expect(advanceDueDate('2026-01-15', 'yearly')).toBe('2027-01-15')
  })
})

describe('rollForwardDueDates', () => {
  it('leaves a subscription untouched when nextDue is already in the future', () => {
    const subs = [{ id: 's1', active: true, frequency: 'monthly', nextDue: '2026-09-17' }]
    expect(rollForwardDueDates(subs, '2026-09-11')).toEqual(subs)
  })

  it('rolls an overdue monthly subscription forward past today, recording lastDue', () => {
    const subs = [{ id: 's1', active: true, frequency: 'monthly', nextDue: '2026-06-17' }]
    const [result] = rollForwardDueDates(subs, '2026-09-11')
    expect(result.nextDue).toBe('2026-09-17')
    expect(result.lastDue).toBe('2026-08-17')
  })

  it('leaves an inactive subscription untouched even if overdue', () => {
    const subs = [{ id: 's1', active: false, frequency: 'monthly', nextDue: '2026-01-17' }]
    expect(rollForwardDueDates(subs, '2026-09-11')).toEqual(subs)
  })
})

describe('findPaymentForSubscription', () => {
  const sub = { id: 's1', category: 'Personal subscription', ledger: 'personal', frequency: 'monthly', amount: 23.99 }

  it('matches a recent transaction by category + ledger within one period', () => {
    const transactions = [
      { date: '2026-08-17', type: 'expense', category: 'Personal subscription', ledger: 'personal', amount: 23.99 }
    ]
    expect(findPaymentForSubscription(sub, transactions, '2026-09-11').amount).toBe(23.99)
  })

  it('matches explicitly via linkedSubId even outside the date window', () => {
    const transactions = [{ date: '2026-01-01', type: 'expense', linkedSubId: 's1', amount: 23.99 }]
    expect(findPaymentForSubscription(sub, transactions, '2026-09-11')).not.toBeNull()
  })

  it('returns null when nothing matches', () => {
    expect(findPaymentForSubscription(sub, [], '2026-09-11')).toBeNull()
  })

  it('does not cross-match a different subscription sharing the same category (regression)', () => {
    // Two subs both categorised "Personal subscription" — their payments must not swap.
    const spotify = { id: 'spotify', category: 'Personal subscription', ledger: 'personal', frequency: 'monthly', amount: 23.99 }
    const amazonPrime = { id: 'prime', category: 'Personal subscription', ledger: 'personal', frequency: 'monthly', amount: 16 }
    const transactions = [
      { date: '2026-08-20', type: 'expense', category: 'Personal subscription', ledger: 'personal', amount: 16, merchant: 'Amazon Prime' },
      { date: '2026-08-20', type: 'expense', category: 'Personal subscription', ledger: 'personal', amount: 23.99, merchant: 'Spotify' },
      { date: '2026-08-20', type: 'expense', category: 'Personal subscription', ledger: 'personal', amount: 40, merchant: 'Careem' }
    ]
    expect(findPaymentForSubscription(spotify, transactions, '2026-09-11').amount).toBe(23.99)
    expect(findPaymentForSubscription(amazonPrime, transactions, '2026-09-11').amount).toBe(16)
  })
})

describe('priceChangeFlag', () => {
  it('flags when the matched payment differs by more than 5%', () => {
    const sub = { amount: 20 }
    expect(priceChangeFlag(sub, { amount: 23 })).toBe(true) // +15%
    expect(priceChangeFlag(sub, { amount: 20.5 })).toBe(false) // +2.5%
  })

  it('is false when there is no matched payment', () => {
    expect(priceChangeFlag({ amount: 20 }, null)).toBe(false)
  })
})

describe('annualCost', () => {
  it('multiplies by the right factor per frequency', () => {
    expect(annualCost({ amount: 10, frequency: 'monthly' })).toBe(120)
    expect(annualCost({ amount: 100, frequency: 'quarterly' })).toBe(400)
    expect(annualCost({ amount: 200, frequency: 'biannual' })).toBe(400)
    expect(annualCost({ amount: 500, frequency: 'yearly' })).toBe(500)
  })
})
