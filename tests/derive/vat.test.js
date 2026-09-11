import { describe, expect, it } from 'vitest'
import { vatForPeriod } from '../../src/lib/derive/vat.js'

const invoices = [
  {
    issueDate: '2026-03-15',
    lines: [
      { qty: 1, unitPrice: 1000, vatTreatment: 'standard' },
      { qty: 1, unitPrice: 200, vatTreatment: 'zero' },
      { qty: 1, unitPrice: 50, vatTreatment: 'exempt' },
      { qty: 1, unitPrice: 999, vatTreatment: 'out_of_scope' }
    ]
  },
  {
    // outside the period — must not contribute
    issueDate: '2026-06-01',
    lines: [{ qty: 1, unitPrice: 5000, vatTreatment: 'standard' }]
  }
]

const transactions = [
  {
    ledger: 'lh_business',
    reclaimable: true,
    docType: 'Tax Invoice',
    date: '2026-03-25',
    amount: 103.95,
    inputVat: 4.95
  },
  {
    // reclaimable but no Tax Invoice on file — must be excluded per the brief
    ledger: 'lh_business',
    reclaimable: true,
    docType: null,
    date: '2026-03-26',
    amount: 51.45,
    inputVat: 2.45
  },
  {
    // wrong ledger — must be excluded
    ledger: 'business',
    reclaimable: true,
    docType: 'Tax Invoice',
    date: '2026-03-27',
    amount: 200,
    inputVat: 9.52
  }
]

const vatAdjustments = [
  { period: 'mar-may', date: '2026-04-10', kind: 'output', amount: 100, vat: 5, description: 'manual output adj' },
  { period: 'mar-may', date: '2026-04-11', kind: 'input', amount: 50, vat: 2.5, description: 'manual input adj' },
  { period: 'mar-may', date: '2026-07-01', kind: 'output', amount: 999, vat: 0, description: 'wrong period, excluded' }
]

describe('vatForPeriod', () => {
  const result = vatForPeriod('2026-mar-may', { invoices, transactions, vatAdjustments })

  it('sums output taxable amounts by treatment, excluding out_of_scope and other periods', () => {
    expect(result.output.standardTaxable).toBe(1000)
    expect(result.output.standardVat).toBe(50)
    expect(result.output.zeroTaxable).toBe(200)
    expect(result.output.exemptTaxable).toBe(50)
  })

  it('only counts input VAT for lh_business transactions that are reclaimable AND have a Tax Invoice', () => {
    expect(result.input.taxable).toBe(99) // 103.95 - 4.95
    expect(result.input.vat).toBe(4.95)
  })

  it('folds in manual adjustments for the period only', () => {
    expect(result.output.adjustmentTaxable).toBe(100)
    expect(result.output.adjustmentVat).toBe(5)
    expect(result.input.adjustmentTaxable).toBe(50)
    expect(result.input.adjustmentVat).toBe(2.5)
  })

  it('computes totals and net payable', () => {
    expect(result.output.totalTaxable).toBe(1350) // 1000 + 200 + 50 + 100
    expect(result.output.totalVat).toBe(55) // 50 + 5
    expect(result.input.totalTaxable).toBe(149) // 99 + 50
    expect(result.input.totalVat).toBe(7.45) // 4.95 + 2.5
    expect(result.netPayable).toBe(47.55) // 55 - 7.45
  })

  it('returns an all-zero box for a period with no activity', () => {
    const empty = vatForPeriod('2027-mar-may', { invoices, transactions, vatAdjustments })
    expect(empty.output.totalTaxable).toBe(0)
    expect(empty.input.totalVat).toBe(0)
    expect(empty.netPayable).toBe(0)
  })
})
