import { describe, expect, it } from 'vitest'
import {
  clientTotals,
  expectedPayments,
  invoicePaidTotal,
  invoiceRemaining,
  invoiceStatus,
  invoiceSubtotal,
  invoiceTotal,
  invoiceVatAmount,
  invoiceVatPeriod,
  nextInvoiceNumber
} from '../../src/lib/derive/invoices.js'

const invoice = {
  number: 'LH-INV-001',
  client: 'Acme Co',
  issueDate: '2026-03-15',
  dueDate: '2026-04-14',
  lines: [
    { description: 'Filming day', qty: 2, unitPrice: 500, vatTreatment: 'standard' },
    { description: 'Export licence', qty: 1, unitPrice: 200, vatTreatment: 'zero' },
    { description: 'Out of scope item', qty: 1, unitPrice: 100, vatTreatment: 'out_of_scope' }
  ],
  payments: []
}

describe('invoice totals', () => {
  it('computes subtotal from every line regardless of VAT treatment', () => {
    expect(invoiceSubtotal(invoice)).toBe(1300) // 1000 + 200 + 100
  })

  it('computes VAT only on standard-rated lines', () => {
    expect(invoiceVatAmount(invoice)).toBe(50) // 5% of 1000
  })

  it('computes total as subtotal + vat', () => {
    expect(invoiceTotal(invoice)).toBe(1350)
  })

  it('derives the VAT period from the issue date', () => {
    expect(invoiceVatPeriod(invoice)).toBe('2026-mar-may')
  })
})

describe('invoice payments and status', () => {
  it('is unpaid with no payments', () => {
    expect(invoicePaidTotal(invoice)).toBe(0)
    expect(invoiceRemaining(invoice)).toBe(1350)
    expect(invoiceStatus(invoice, '2026-04-01')).toBe('unpaid')
  })

  it('is overdue once past the due date with nothing paid', () => {
    expect(invoiceStatus(invoice, '2026-05-01')).toBe('overdue')
  })

  it('is partial once some, but not all, has been paid', () => {
    const partiallyPaid = { ...invoice, payments: [{ date: '2026-03-20', amount: 500, kind: 'down' }] }
    expect(invoiceRemaining(partiallyPaid)).toBe(850)
    expect(invoiceStatus(partiallyPaid, '2026-04-01')).toBe('partial')
  })

  it('is paid once fully settled', () => {
    const paid = { ...invoice, payments: [{ date: '2026-03-20', amount: 1350, kind: 'full' }] }
    expect(invoiceStatus(paid, '2026-04-01')).toBe('paid')
  })

  it('subtracts a refund payment from the paid total', () => {
    const refunded = {
      ...invoice,
      payments: [
        { date: '2026-03-20', amount: 1350, kind: 'full' },
        { date: '2026-03-25', amount: 200, kind: 'refund' }
      ]
    }
    expect(invoicePaidTotal(refunded)).toBe(1150)
    expect(invoiceRemaining(refunded)).toBe(200)
  })
})

describe('nextInvoiceNumber', () => {
  it('starts at 001 with no existing invoices', () => {
    expect(nextInvoiceNumber([])).toBe('LH-INV-001')
  })

  it('increments past the highest existing number', () => {
    expect(nextInvoiceNumber([{ number: 'LH-INV-003' }, { number: 'LH-INV-001' }])).toBe('LH-INV-004')
  })
})

describe('clientTotals', () => {
  it('aggregates invoiced/paid/remaining per client, largest remaining first', () => {
    const invoices = [
      { client: 'Acme', lines: [{ qty: 1, unitPrice: 1000, vatTreatment: 'standard' }], payments: [] },
      { client: 'Beta', lines: [{ qty: 1, unitPrice: 200, vatTreatment: 'zero' }], payments: [{ amount: 200, kind: 'full' }] }
    ]
    const totals = clientTotals(invoices)
    expect(totals[0]).toMatchObject({ client: 'Acme', invoiced: 1050, paid: 0, remaining: 1050 })
    expect(totals[1]).toMatchObject({ client: 'Beta', invoiced: 200, paid: 200, remaining: 0 })
  })
})

describe('expectedPayments', () => {
  it('excludes fully paid invoices and flags anything due within 7 days', () => {
    const dueSoon = { ...invoice, dueDate: '2026-04-05' }
    const dueLater = { ...invoice, dueDate: '2026-06-01' }
    const paidOff = { ...invoice, payments: [{ amount: 1350, kind: 'full' }] }

    const result = expectedPayments([dueSoon, dueLater, paidOff], { today: '2026-04-01' })
    expect(result).toHaveLength(2)
    expect(result[0].invoice).toBe(dueSoon)
    expect(result[0].dueSoon).toBe(true)
    expect(result[1].dueSoon).toBe(false)
  })
})
