// RAKBANK's "Account Statement" text export (online banking → Account Transactions → TXT, one file
// per period). Fixed-width: Date, Description, Cheque No, Withdrawal, Deposit, Balance, newest
// first, with the description wrapping onto continuation lines under the row.
//
// Unlike the SMS and card-statement parsers this is a *company* account (Leaf & Hook FZ LLC), so
// two things matter that don't elsewhere: VAT (bank charges carry 5% input VAT that is
// reclaimable once the company is VAT-registered) and what is NOT business income/expense at all
// — money the company moves to its owner, cash withdrawals, Stripe payouts, and the tax payment
// itself are movements, not P&L.
import { normaliseMerchant } from './merchants.js'
import { VAT_REGISTRATION_DATE } from '../../data/vatPeriods.js'
import { OWNER_NAME_RE } from '../../data/owner.js'

const ROW_START_RE = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\S.*)$/
const AMOUNT_RE = /[\d,]+\.\d\d/g
const VALUE_DATE_RE = /^Value Date:/i

function round2(value) {
  return Math.round(value * 100) / 100
}

function toNumber(text) {
  return parseFloat(String(text).replace(/,/g, ''))
}

// Column right-edges come from the header line itself so a slightly different export width still
// works: a number belongs to whichever of Withdrawal / Deposit / Balance its right edge is nearest.
function columnEdges(headerLine) {
  const edge = (word) => headerLine.indexOf(word) + word.length
  return { withdrawal: edge('Withdrawal'), deposit: edge('Deposit'), balance: edge('Balance') }
}

function nearestColumn(end, edges) {
  return Object.entries(edges).sort((a, b) => Math.abs(a[1] - end) - Math.abs(b[1] - end))[0][0]
}

export function looksLikeRakTxt(text) {
  const head = String(text).slice(0, 8000)
  return /Account Statement/i.test(head) && /Withdrawal\s+Deposit\s+Balance/i.test(head) && /RAK/i.test(head)
}

// Reads the raw layout into plain rows: { date, description, withdrawal, deposit, balance }.
export function readRakTxtRows(text) {
  const lines = String(text).replace(/\r/g, '').split('\n')
  const headerIndex = lines.findIndex((line) => /^Date\s+Description/.test(line) && /Withdrawal/.test(line))
  if (headerIndex === -1) return []
  const edges = columnEdges(lines[headerIndex])

  const rows = []
  let current = null
  const flush = () => {
    if (current) rows.push(current)
    current = null
  }

  for (const line of lines.slice(headerIndex + 1)) {
    if (/^_{5,}/.test(line) || /^\s*Total\b/.test(line)) {
      flush()
      continue
    }
    const start = ROW_START_RE.exec(line)
    if (start) {
      flush()
      const [, day, month, year, rest] = start
      const amounts = { withdrawal: null, deposit: null, balance: null }
      for (const match of line.matchAll(AMOUNT_RE)) {
        amounts[nearestColumn(match.index + match[0].length, edges)] = toNumber(match[0])
      }
      current = {
        date: `${year}-${month}-${day}`,
        parts: [rest.split(/\s{3,}/)[0].trim()],
        withdrawal: amounts.withdrawal,
        deposit: amounts.deposit,
        balance: amounts.balance
      }
      continue
    }
    const trimmed = line.trim()
    if (current && trimmed && !VALUE_DATE_RE.test(trimmed)) current.parts.push(trimmed)
  }
  flush()

  return rows.map(({ parts, ...row }) => ({ ...row, description: parts.join(' ').replace(/\s+/g, ' ').trim() }))
}

function bankFeeLabel(upper) {
  if (upper.includes('MAINT_TRAN_CHRG')) return 'Account maintenance'
  if (upper.includes('RAKVALUE')) return 'RAKvalue monthly fee'
  if (upper.includes('CHEQUE BOOK')) return 'Cheque book charge'
  if (upper.includes('OUTWARD REMITTANCE CHA') || /CHARGE COLLECTION-INCL\. VAT CHARGE COLLECTION-INCL\. VAT 1\.00/.test(upper)) {
    return 'Outward transfer charge'
  }
  if (/REF:\d+/.test(upper)) return 'Instant transfer charge'
  return 'Bank charge'
}

// Classifies one statement entry. `isCredit` is which column the money appeared in.
export function categoriseRakTxtEntry(description, { isCredit, amount, date, ownerPattern = OWNER_NAME_RE }) {
  const text = String(description || '').replace(/\s+/g, ' ').trim()
  const upper = text.toUpperCase()

  // Bank charges: the statement amount INCLUDES 5% VAT. From the VAT-registration date it is
  // reclaimable input VAT, and the bank's own e-statement is the evidence (the owner treats it as
  // a valid tax document), so it is flagged as such for the VAT return.
  if (!isCredit && (upper.startsWith('CHARGE COLLECTION') || upper.startsWith('COLLECTION COMM') || upper.includes('RAKVALUE FEE'))) {
    const registered = date >= VAT_REGISTRATION_DATE
    return {
      ruleId: 'RAKTXT_BANK_FEE',
      rawMerchant: `RAK Bank – ${bankFeeLabel(upper)}`,
      type: 'expense',
      category: 'LH – Bank Fees',
      ledger: 'lh_business',
      inputVat: registered ? round2(amount - amount / 1.05) : null,
      reclaimable: registered,
      docType: registered ? 'Tax Invoice' : null
    }
  }

  if (upper.startsWith('OUTWARD T/T') && upper.includes('FEDERAL TAX AUTHORITY')) {
    return { ruleId: 'RAKTXT_FTA_PAYMENT', rawMerchant: 'Federal Tax Authority – VAT payment', type: 'expense', category: 'LH – VAT', ledger: 'lh_business', direction: null }
  }

  if (upper.startsWith('OUTWARD T/T') && ownerPattern.test(text)) {
    return { ruleId: 'RAKTXT_OWNER_TRANSFER', rawMerchant: 'Transfer to owner', type: 'transfer', category: 'Transfer', ledger: 'lh_business', direction: 'out' }
  }

  if (upper.startsWith('OUTWARD T/T')) {
    const payee = text.replace(/^OUTWARD T\/T\s*/i, '').replace(/^1\.00\s*/, '').trim()
    return { ruleId: 'RAKTXT_OUTWARD_TT', rawMerchant: `Transfer to ${payee || 'beneficiary'}`, type: 'expense', category: 'LH – Supplier Payment', ledger: 'lh_business' }
  }

  if (upper.startsWith('AANI TO')) {
    const payee = text.replace(/^AANI TO\s*/i, '').replace(/\s+\d{6,}.*$/, '').trim()
    return { ruleId: 'RAKTXT_AANI_OUT', rawMerchant: `Aani transfer to ${payee}`, type: 'expense', category: 'LH – Supplier Payment', ledger: 'lh_business' }
  }

  if (upper.startsWith('FUNDS TRANSFER WITHIN')) {
    const payee = text.replace(/^.*\bTo\s+\d{6,}\s*/i, '').trim()
    return { ruleId: 'RAKTXT_INTERNAL_TRANSFER', rawMerchant: `Transfer to ${payee || 'RAKBANK account'}`, type: isCredit ? 'income' : 'expense', category: isCredit ? 'Other Income' : 'LH – Supplier Payment', ledger: isCredit ? 'income' : 'lh_business' }
  }

  if (upper.startsWith('AANI FROM')) {
    const payer = text.replace(/^AANI FROM\s*/i, '').replace(/\s+T_[0-9a-f]{20,}.*$/i, '').replace(/\s+M\d{4,}.*$/, '').trim()
    return { ruleId: 'RAKTXT_AANI_IN', rawMerchant: `Aani transfer from ${payer}`, type: 'income', category: 'Other Income', ledger: 'income' }
  }

  if (upper.startsWith('INWARD T/T')) {
    // Stripe pays out through this entity. The sessions themselves are recorded from the Stripe
    // export, so the payout is just money moving into the bank — counting it again as income
    // would double the revenue.
    if (upper.includes('NTSUB_') || upper.includes('LEAFAN') || upper.includes('NETWORK INTERNAT')) {
      return { ruleId: 'RAKTXT_STRIPE_PAYOUT', rawMerchant: 'Stripe payout', type: 'transfer', category: 'Transfer', ledger: 'lh_business', direction: 'in' }
    }
    if (ownerPattern.test(text)) {
      return { ruleId: 'RAKTXT_OWNER_IN', rawMerchant: 'Transfer from owner', type: 'transfer', category: 'Transfer', ledger: 'lh_business', direction: 'in' }
    }
    const payer = text
      .replace(/^INWARD T\/T\s*/i, '')
      .replace(/\/REF\/\S*/gi, '')
      .replace(/\/URI\/\S*/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
    return { ruleId: 'RAKTXT_INWARD_TT', rawMerchant: payer || 'Inward transfer', type: 'income', category: 'Other Income', ledger: 'income' }
  }

  // Cash out of the company account is a movement to the owner, not a business cost.
  if (upper.startsWith('ATM CASH WITHDRAWAL')) {
    return { ruleId: 'RAKTXT_ATM', rawMerchant: 'ATM cash withdrawal', type: 'transfer', category: 'Transfer', ledger: 'lh_business', direction: 'out' }
  }

  if (upper.startsWith('PURCHASE TRXN.-REV') || upper.startsWith('PURCHASE TRXN-REV')) {
    const merchant = text.replace(/^PURCHASE TRXN\.?-REV\s*/i, '').replace(/\s*\d{6}X+\d{4}.*$/i, '').trim()
    return { ruleId: 'RAKTXT_CARD_REFUND', rawMerchant: merchant, type: 'refund', category: 'LH – Other', ledger: 'lh_business' }
  }

  if (upper.startsWith('PURCHASE TRXN')) {
    const merchant = text.replace(/^PURCHASE TRXN\.?\s*/i, '').replace(/\s*\d{6}X+\d{4}.*$/i, '').trim()
    return { ruleId: 'RAKTXT_CARD_PURCHASE', rawMerchant: merchant, type: 'expense', category: 'LH – Other', ledger: 'lh_business' }
  }

  return {
    ruleId: 'RAKTXT_UNRECOGNISED',
    rawMerchant: text.slice(0, 80) || 'RAK Bank transaction',
    type: isCredit ? 'income' : 'expense',
    category: isCredit ? 'Other Income' : 'LH – Other',
    ledger: isCredit ? 'income' : 'lh_business'
  }
}

export function parseRakTxt(text, { ownerPattern = OWNER_NAME_RE } = {}) {
  return readRakTxtRows(text)
    .filter((row) => (row.withdrawal ?? row.deposit) != null)
    .map((row) => {
      const isCredit = row.deposit != null
      const amount = isCredit ? row.deposit : row.withdrawal
      const classified = categoriseRakTxtEntry(row.description, { isCredit, amount, date: row.date, ownerPattern })
      return {
        ruleId: classified.ruleId,
        date: row.date,
        rawMerchant: classified.rawMerchant,
        merchant: normaliseMerchant(classified.rawMerchant) || classified.rawMerchant,
        amount,
        currency: 'AED',
        fxRate: 1,
        fxAmount: amount,
        type: classified.type,
        direction: classified.type === 'transfer' ? classified.direction : null,
        paymentMethod: 'RAK Bank',
        ledger: classified.ledger,
        category: classified.category,
        inputVat: classified.inputVat ?? null,
        reclaimable: classified.reclaimable ?? false,
        docType: classified.docType ?? null,
        bankRef: null,
        balanceAfter: row.balance,
        notes: row.description,
        sourceLine: row.description
      }
    })
}
