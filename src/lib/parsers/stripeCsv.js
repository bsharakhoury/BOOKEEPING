import { parseCsv } from '../csv.js'

function round2(value) {
  return Math.round(value * 100) / 100
}

function columnIndex(header, name) {
  return header.indexOf(name)
}

// Stripe's balance-history CSV export: id, Type, Description, Amount, Fee, Net, Currency,
// "Created (UTC)". A payout row becomes a transfer (money leaving Stripe for the bank — excluded
// from every income/expense total, per the brief). A charge/payment row becomes Leaf & Hook –
// Wellness income, plus a separate LH – Bank Fees expense for its fee if one was charged.
export function parseStripeCsv(text) {
  const allRows = parseCsv(text)
  if (allRows.length < 2) return []

  const header = allRows[0].map((cell) => cell.trim().toLowerCase())
  const iType = columnIndex(header, 'type')
  const iDescription = columnIndex(header, 'description')
  const iAmount = columnIndex(header, 'amount')
  const iFee = columnIndex(header, 'fee')
  const iCreated = columnIndex(header, 'created (utc)')

  const rows = []

  for (let r = 1; r < allRows.length; r++) {
    const cols = allRows[r]
    if (cols.length < 2) continue

    const type = (cols[iType] || '').trim().toLowerCase()
    const description = (cols[iDescription] || '').trim()
    const amount = parseFloat(cols[iAmount] || '0') || 0
    const fee = iFee >= 0 ? parseFloat(cols[iFee] || '0') || 0 : 0
    const date = (cols[iCreated] || '').trim().slice(0, 10)
    const bankRef = cols[0] || null

    if (!date) continue

    if (type === 'payout') {
      rows.push({
        ruleId: 'STRIPE_PAYOUT',
        date,
        rawMerchant: description || 'Stripe payout',
        merchant: description || 'Stripe payout',
        amount: round2(Math.abs(amount)),
        currency: 'AED',
        fxRate: 1,
        fxAmount: round2(Math.abs(amount)),
        type: 'transfer',
        paymentMethod: 'Stripe',
        ledger: 'lh_business',
        category: 'Transfer',
        inputVat: null,
        reclaimable: false,
        bankRef,
        notes: description,
        sourceLine: cols.join(' | ')
      })
      continue
    }

    if (type === 'charge' || type === 'payment') {
      rows.push({
        ruleId: 'STRIPE_SESSION',
        date,
        rawMerchant: description || 'Stripe session',
        merchant: description || 'Stripe session',
        amount: round2(Math.abs(amount)),
        currency: 'AED',
        fxRate: 1,
        fxAmount: round2(Math.abs(amount)),
        type: 'income',
        paymentMethod: 'Stripe',
        ledger: 'income',
        category: 'Leaf & Hook – Wellness',
        inputVat: null,
        reclaimable: false,
        bankRef,
        notes: description,
        sourceLine: cols.join(' | ')
      })

      if (fee > 0) {
        rows.push({
          ruleId: 'STRIPE_FEE',
          date,
          rawMerchant: `Stripe fee — ${description}`.trim(),
          merchant: 'Stripe fee',
          amount: round2(fee),
          currency: 'AED',
          fxRate: 1,
          fxAmount: round2(fee),
          type: 'expense',
          paymentMethod: 'Stripe',
          ledger: 'lh_business',
          category: 'LH – Bank Fees',
          inputVat: null,
          reclaimable: false,
          bankRef,
          notes: `Fee for ${description}`,
          sourceLine: cols.join(' | ')
        })
      }
    }
  }

  return rows
}
