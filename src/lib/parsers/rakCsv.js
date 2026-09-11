import { parseCsv } from '../csv.js'

function round2(value) {
  return Math.round(value * 100) / 100
}

const DDMMYYYY_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/

function toISO(ddmmyyyy) {
  const match = DDMMYYYY_RE.exec(String(ddmmyyyy).trim())
  if (!match) return null
  const [, dd, mm, yyyy] = match
  return `${yyyy}-${mm}-${dd}`
}

// Shared with rakStatement.js — the same bank vocabulary shows up whether the data arrives as
// a CSV export or pasted statement text.
export function categoriseRakDescription(description, amount) {
  const descUpper = String(description).toUpperCase()

  if (descUpper.includes('PURCHASE TRXN.-REV')) {
    return { category: 'LH – Other', inputVat: null, reclaimable: false, typeOverride: 'refund' }
  }

  if (
    (descUpper.includes('CHARGE COLLECTION') && descUpper.includes('INCL VAT')) ||
    descUpper.includes('RAKVALUE MONTHLY FEE')
  ) {
    return { category: 'LH – Bank Fees', inputVat: round2(amount - amount / 1.05), reclaimable: true, typeOverride: null }
  }

  if (descUpper.includes('OUTWARD T/T') && descUpper.includes('FEDERAL TAX AUTHORITY')) {
    return { category: 'LH – VAT', inputVat: null, reclaimable: false, typeOverride: null }
  }

  return { category: 'LH – Other', inputVat: null, reclaimable: false, typeOverride: null }
}

// RAK Bank's Account_Transactions_CSV export: a metadata header block (account number,
// statement period, blank lines) followed by data rows shaped
// [ , postDate dd/mm/yyyy, , valueDate, ref, , description(multiline), cardOrRef, memo, debit,
// credit, balance ]. We find the real data rows by column shape (postDate parses as dd/mm/yyyy)
// rather than by matching the header block's exact wording.
export function parseRakCsv(text) {
  const rows = []

  for (const cols of parseCsv(text)) {
    if (cols.length < 12) continue

    const postDate = toISO(cols[1])
    if (!postDate) continue // metadata/header row — not a transaction

    const ref = (cols[4] || '').trim()
    const description = (cols[6] || '').replace(/\s+/g, ' ').trim()
    const cardOrRef = (cols[7] || '').trim()
    const debit = parseFloat((cols[9] || '').replace(/,/g, ''))
    const credit = parseFloat((cols[10] || '').replace(/,/g, ''))

    const hasDebit = Number.isFinite(debit) && debit > 0
    const hasCredit = Number.isFinite(credit) && credit > 0
    if (!hasDebit && !hasCredit) continue

    const amount = hasDebit ? debit : credit
    const { category, inputVat, reclaimable, typeOverride } = categoriseRakDescription(description, amount)

    rows.push({
      ruleId: 'RAK_CSV',
      date: postDate,
      rawMerchant: description || cardOrRef || 'RAK Bank transaction',
      merchant: description || cardOrRef || 'RAK Bank transaction',
      amount,
      currency: 'AED',
      fxRate: 1,
      fxAmount: amount,
      type: typeOverride || (hasDebit ? 'expense' : 'income'),
      paymentMethod: 'RAK Bank',
      ledger: 'lh_business',
      category,
      inputVat,
      reclaimable,
      bankRef: ref || cardOrRef || null,
      notes: description,
      sourceLine: cols.join(' | ')
    })
  }

  return rows
}
