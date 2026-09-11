import { describe, expect, it } from 'vitest'
import { findDuplicateGroups, findDuplicateIndex, isDuplicate } from '../src/lib/duplicates.js'

const existing = [
  { id: '1', date: '2026-03-10', amount: 103.95, rawMerchant: 'CHARGE COLLECTION MAR26 INCL VAT', bankRef: 'REF003' },
  { id: '2', date: '2026-03-11', amount: 50, rawMerchant: 'CAREEM FOOD, Dubai', bankRef: null }
]

describe('duplicates', () => {
  it('matches on bankRef first when present', () => {
    const row = { date: '2099-01-01', amount: 1, rawMerchant: 'unrelated', bankRef: 'REF003' }
    expect(findDuplicateIndex(row, existing)).toBe(0)
    expect(isDuplicate(row, existing)).toBe(true)
  })

  it('falls back to date|amount|rawMerchant when there is no bankRef match', () => {
    const row = { date: '2026-03-11', amount: 50, rawMerchant: 'CAREEM FOOD, Dubai', bankRef: null }
    expect(findDuplicateIndex(row, existing)).toBe(1)
  })

  it('is not a duplicate when date, amount, or merchant differ', () => {
    const row = { date: '2026-03-12', amount: 50, rawMerchant: 'CAREEM FOOD, Dubai', bankRef: null }
    expect(isDuplicate(row, existing)).toBe(false)
  })
})

describe('findDuplicateGroups', () => {
  it('groups transactions sharing a bankRef', () => {
    const transactions = [
      { id: '1', bankRef: 'REF1', date: '2026-01-01', amount: 10, rawMerchant: 'A' },
      { id: '2', bankRef: 'REF1', date: '2026-01-02', amount: 99, rawMerchant: 'B' },
      { id: '3', bankRef: 'REF2', date: '2026-01-03', amount: 20, rawMerchant: 'C' }
    ]
    const groups = findDuplicateGroups(transactions)
    expect(groups).toHaveLength(1)
    expect(groups[0].map((t) => t.id)).toEqual(['1', '2'])
  })

  it('falls back to date|amount|rawMerchant when there is no bankRef', () => {
    const transactions = [
      { id: '1', bankRef: null, date: '2026-01-01', amount: 10, rawMerchant: 'Careem' },
      { id: '2', bankRef: null, date: '2026-01-01', amount: 10, rawMerchant: 'Careem' },
      { id: '3', bankRef: null, date: '2026-01-02', amount: 10, rawMerchant: 'Careem' }
    ]
    const groups = findDuplicateGroups(transactions)
    expect(groups).toHaveLength(1)
    expect(groups[0].map((t) => t.id)).toEqual(['1', '2'])
  })

  it('returns no groups when nothing repeats', () => {
    expect(findDuplicateGroups(existing)).toHaveLength(0)
  })
})
