import { periodKeyForDate } from '../../data/vatPeriods.js'
import { todayISO } from '../dates.js'

const VAT_RATE = 0.05

function round2(value) {
  return Math.round(value * 100) / 100
}

export function lineAmount(line) {
  return round2((Number(line.qty) || 0) * (Number(line.unitPrice) || 0))
}

export function lineVat(line) {
  return line.vatTreatment === 'standard' ? round2(lineAmount(line) * VAT_RATE) : 0
}

// subtotal, vatAmount, total, remaining, status, vatPeriod are all computed — never stored, per
// the data model.
export function invoiceSubtotal(invoice) {
  return round2((invoice.lines || []).reduce((sum, line) => sum + lineAmount(line), 0))
}

export function invoiceVatAmount(invoice) {
  return round2((invoice.lines || []).reduce((sum, line) => sum + lineVat(line), 0))
}

export function invoiceTotal(invoice) {
  return round2(invoiceSubtotal(invoice) + invoiceVatAmount(invoice))
}

export function invoicePaidTotal(invoice) {
  return round2(
    (invoice.payments || []).reduce((sum, payment) => sum + (payment.kind === 'refund' ? -payment.amount : payment.amount), 0)
  )
}

export function invoiceRemaining(invoice) {
  return round2(invoiceTotal(invoice) - invoicePaidTotal(invoice))
}

export function invoiceStatus(invoice, today = todayISO()) {
  const remaining = invoiceRemaining(invoice)
  const paid = invoicePaidTotal(invoice)
  const overdue = Boolean(invoice.dueDate) && invoice.dueDate < today

  if (remaining <= 0) return 'paid'
  if (paid > 0) return overdue ? 'overdue' : 'partial'
  return overdue ? 'overdue' : 'unpaid'
}

export function invoiceVatPeriod(invoice) {
  return periodKeyForDate(invoice.issueDate)
}

const NUMBER_RE = /^LH-INV-(\d+)$/

export function nextInvoiceNumber(invoices) {
  const max = invoices.reduce((highest, invoice) => {
    const match = NUMBER_RE.exec(invoice.number || '')
    if (!match) return highest
    return Math.max(highest, Number(match[1]))
  }, 0)
  return `LH-INV-${String(max + 1).padStart(3, '0')}`
}

export function clientTotals(invoices) {
  const totals = new Map()
  invoices.forEach((invoice) => {
    const client = invoice.client || 'Unknown'
    const entry = totals.get(client) || { client, invoiced: 0, paid: 0, remaining: 0 }
    entry.invoiced = round2(entry.invoiced + invoiceTotal(invoice))
    entry.paid = round2(entry.paid + invoicePaidTotal(invoice))
    entry.remaining = round2(entry.remaining + invoiceRemaining(invoice))
    totals.set(client, entry)
  })
  return Array.from(totals.values()).sort((a, b) => b.remaining - a.remaining)
}

// Invoices still owed, soonest due first — with a 7-day-due highlight for "Expected payments".
export function expectedPayments(invoices, { today = todayISO(), highlightDays = 7 } = {}) {
  const highlightDate = new Date(today)
  highlightDate.setDate(highlightDate.getDate() + highlightDays)
  const highlightCutoff = highlightDate.toISOString().slice(0, 10)

  return invoices
    .filter((invoice) => invoiceRemaining(invoice) > 0)
    .map((invoice) => ({
      invoice,
      remaining: invoiceRemaining(invoice),
      dueSoon: Boolean(invoice.dueDate) && invoice.dueDate <= highlightCutoff
    }))
    .sort((a, b) => (a.invoice.dueDate || '') < (b.invoice.dueDate || '') ? -1 : 1)
}
