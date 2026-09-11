import { describe, expect, it } from 'vitest'
import { filterTransactions, parseSearchQuery } from '../src/lib/transactionSearch.js'

const TRANSACTIONS = [
  {
    id: '1',
    date: '2026-08-05',
    merchant: 'Carrefour',
    rawMerchant: 'MAJID AL FUTTAIM HM',
    category: 'Food (Groceries)',
    ledger: 'personal',
    amount: 320,
    type: 'expense',
    paymentMethod: 'Mashreq Debit 9437',
    notes: '',
    tags: ['weekly']
  },
  {
    id: '2',
    date: '2026-08-12',
    merchant: 'Netflix',
    rawMerchant: 'NETFLIX.COM',
    category: 'Personal subscription',
    ledger: 'personal',
    amount: 45,
    type: 'expense',
    paymentMethod: 'Mashreq Credit 8777',
    notes: '',
    tags: []
  },
  {
    id: '3',
    date: '2026-09-01',
    merchant: 'Beno',
    rawMerchant: 'SALARY BENO',
    category: 'Salary – Beno',
    ledger: 'income',
    amount: 15000,
    type: 'income',
    paymentMethod: 'Mashreq Debit 9437',
    notes: 'monthly salary',
    tags: []
  },
  {
    id: '4',
    date: '2026-09-03',
    merchant: 'Own account',
    rawMerchant: 'AANI TRANSFER',
    category: 'Transfer',
    ledger: 'personal',
    amount: 1000,
    type: 'transfer',
    paymentMethod: 'Mashreq Transfer',
    notes: '',
    tags: []
  }
]

describe('parseSearchQuery', () => {
  it('extracts cat:, acct:, tag: and >amount operators from free text', () => {
    const parsed = parseSearchQuery('cat:Groceries acct:Mashreq >100 weekly')
    expect(parsed).toEqual({ cat: 'groceries', acct: 'mashreq', tag: null, minAmount: 100, text: ['weekly'] })
  })
})

describe('filterTransactions', () => {
  it('filters by ledger chip, treating "transfers" as a type filter', () => {
    expect(filterTransactions(TRANSACTIONS, { ledger: 'transfers' })).toEqual([TRANSACTIONS[3]])
    expect(filterTransactions(TRANSACTIONS, { ledger: 'income' })).toEqual([TRANSACTIONS[2]])
  })

  it('filters by month chip', () => {
    const result = filterTransactions(TRANSACTIONS, { month: '2026-08' })
    expect(result.map((t) => t.id)).toEqual(['1', '2'])
  })

  it('applies the cat: operator against the category name', () => {
    const result = filterTransactions(TRANSACTIONS, { query: 'cat:subscription' })
    expect(result.map((t) => t.id)).toEqual(['2'])
  })

  it('applies the >amount operator', () => {
    const result = filterTransactions(TRANSACTIONS, { query: '>1000' })
    expect(result.map((t) => t.id)).toEqual(['3'])
  })

  it('applies free text against merchant and notes', () => {
    const result = filterTransactions(TRANSACTIONS, { query: 'salary' })
    expect(result.map((t) => t.id)).toEqual(['3'])
  })
})
