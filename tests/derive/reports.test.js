import { describe, expect, it } from 'vitest'
import {
  cashFlowSeries,
  categoryTrend,
  customRangeReport,
  incomeByClient,
  incomeByStream,
  lhProfitAndLoss,
  monthOverMonthVariance,
  runwayMonths
} from '../../src/lib/derive/reports.js'

const transactions = [
  { date: '2026-08-05', type: 'income', category: 'Salary – Beno', amount: 5000, tags: [] },
  { date: '2026-08-06', type: 'expense', ledger: 'personal', category: 'Food (Groceries)', amount: 300 },
  { date: '2026-09-05', type: 'income', category: 'Salary – Beno', amount: 5000, tags: [] },
  { date: '2026-09-06', type: 'expense', ledger: 'personal', category: 'Food (Groceries)', amount: 400 },
  { date: '2026-09-07', type: 'refund', ledger: 'personal', category: 'Food (Groceries)', amount: 50 },
  { date: '2026-09-08', type: 'income', category: 'Leaf & Hook – Wellness', amount: 1000, tags: ['client:Acme'] },
  { date: '2026-09-09', type: 'expense', ledger: 'lh_business', category: 'LH – Production Costs', amount: 600 },
  { date: '2026-09-10', type: 'expense', ledger: 'lh_business', category: 'LH – Bank Fees', amount: 50 },
  { date: '2026-09-11', type: 'expense', ledger: 'lh_business', category: 'LH – VAT', amount: 200 }
]

const categories = [
  { name: 'Salary – Beno', type: 'income', stream: 'salary' },
  { name: 'Leaf & Hook – Wellness', type: 'income', stream: 'lh_wellness' }
]

describe('cashFlowSeries', () => {
  it('nets refunds against expense per month, oldest first', () => {
    const series = cashFlowSeries(transactions, { months: 2, today: '2026-09-11' })
    expect(series).toHaveLength(2)
    expect(series[0]).toMatchObject({ month: '2026-08', income: 5000, expense: 300 })
    expect(series[1]).toMatchObject({ month: '2026-09', income: 6000, expense: 1200 }) // 400 - 50 + 600 + 50 + 200
  })
})

describe('categoryTrend', () => {
  it('tracks one category across months, netting refunds', () => {
    const trend = categoryTrend(transactions, 'Food (Groceries)', { months: 2, today: '2026-09-11' })
    expect(trend[0]).toMatchObject({ month: '2026-08', amount: 300 })
    expect(trend[1]).toMatchObject({ month: '2026-09', amount: 350 }) // 400 - 50
  })
})

describe('monthOverMonthVariance', () => {
  it('compares this month to last, sorted by biggest absolute change', () => {
    const variance = monthOverMonthVariance(transactions, { today: '2026-09-11' })
    const groceries = variance.find((v) => v.category === 'Food (Groceries)')
    expect(groceries).toMatchObject({ previous: 300, current: 350, delta: 50 })
    expect(Math.round(groceries.deltaPct)).toBe(17) // ~16.67%
  })
})

describe('incomeByStream / incomeByClient', () => {
  const range = { start: '2026-09-01', end: '2026-09-30' }

  it('buckets income by stream for the range', () => {
    const byStream = incomeByStream(transactions, categories, range)
    expect(byStream).toContainEqual({ stream: 'salary', label: 'Salary', amount: 5000 })
    expect(byStream).toContainEqual({ stream: 'lh_wellness', label: 'Leaf & Hook – Wellness', amount: 1000 })
  })

  it('buckets income by client tag, defaulting to Unassigned', () => {
    const byClient = incomeByClient(transactions, range)
    expect(byClient).toContainEqual({ client: 'Acme', amount: 1000 })
    expect(byClient).toContainEqual({ client: 'Unassigned', amount: 5000 })
  })
})

describe('lhProfitAndLoss', () => {
  it('identifies L&H revenue by category stream (income always carries ledger "income"), separates production costs from opex, and excludes VAT payments entirely', () => {
    const range = { start: '2026-09-01', end: '2026-09-30' }
    const result = lhProfitAndLoss(transactions, [], categories, range)
    expect(result).toEqual({ revenue: 1000, productionCosts: 600, opex: 50, net: 350 })
  })
})

describe('customRangeReport', () => {
  const rangeTxns = [
    { date: '2026-08-05', type: 'income', ledger: 'income', category: 'Salary – Beno', amount: 5000 },
    { date: '2026-08-06', type: 'expense', ledger: 'personal', category: 'Food (Groceries)', amount: 300 },
    { date: '2026-09-05', type: 'income', ledger: 'income', category: 'Salary – Beno', amount: 5000 },
    { date: '2026-09-06', type: 'expense', ledger: 'personal', category: 'Food (Groceries)', amount: 400 },
    { date: '2026-09-07', type: 'refund', ledger: 'personal', category: 'Food (Groceries)', amount: 50 },
    { date: '2026-09-09', type: 'expense', ledger: 'business', category: 'Marketing', amount: 999 } // excluded: wrong ledger
  ]
  const rangeCategories = [
    { name: 'Salary – Beno', type: 'income', color: 'var(--color-sage)' },
    { name: 'Food (Groceries)', type: 'expense', color: 'var(--color-sage)' },
    { name: 'Marketing', type: 'expense', color: 'var(--color-amber)' }
  ]

  it('filters by ledger and category, totals and averages per category over the range', () => {
    const report = customRangeReport(rangeTxns, rangeCategories, {
      startMonth: '2026-08',
      endMonth: '2026-09',
      ledgers: ['income', 'personal'],
      categoryNames: ['Salary – Beno', 'Food (Groceries)']
    })

    expect(report.monthCount).toBe(2)
    expect(report.incomeByCategory).toEqual([{ name: 'Salary – Beno', color: 'var(--color-sage)', amount: 10000, avgPerMonth: 5000 }])
    expect(report.expensesByCategory).toEqual([
      { name: 'Food (Groceries)', color: 'var(--color-sage)', amount: 650, avgPerMonth: 325 } // 300 + 400 - 50
    ])
    expect(report.summary).toEqual({ netIncome: 10000, totalExpenses: 650, netPosition: 9350, avgMonthlyNet: 4675 })
  })

  it('excludes ledgers and categories not selected', () => {
    const report = customRangeReport(rangeTxns, rangeCategories, {
      startMonth: '2026-08',
      endMonth: '2026-09',
      ledgers: ['income', 'personal'],
      categoryNames: ['Salary – Beno', 'Food (Groceries)']
    })
    expect(report.expensesByCategory.find((row) => row.name === 'Marketing')).toBeUndefined()
  })

  it('builds a month-by-month breakdown with vs-average deltas', () => {
    const report = customRangeReport(rangeTxns, rangeCategories, {
      startMonth: '2026-08',
      endMonth: '2026-09',
      ledgers: ['income', 'personal'],
      categoryNames: ['Salary – Beno', 'Food (Groceries)']
    })
    expect(report.monthly).toEqual([
      { month: '2026-08', label: 'Aug 2026', income: 5000, expense: 300, net: 4700, vsAvg: 25 },
      { month: '2026-09', label: 'Sep 2026', income: 5000, expense: 350, net: 4650, vsAvg: -25 }
    ])
  })
})

describe('runwayMonths', () => {
  it('returns null when average burn is break-even or positive', () => {
    const profitable = [{ date: '2026-09-01', type: 'income', amount: 1000 }]
    expect(runwayMonths(5000, profitable, { months: 1, today: '2026-09-11' })).toBeNull()
  })

  it('divides cash position by average monthly burn when burning cash', () => {
    const burning = [
      { date: '2026-08-01', type: 'expense', amount: 1000 },
      { date: '2026-09-01', type: 'expense', amount: 1000 }
    ]
    expect(runwayMonths(3000, burning, { months: 2, today: '2026-09-11' })).toBe(3)
  })
})
