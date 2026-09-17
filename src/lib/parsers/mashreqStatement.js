// Mashreq's own "Account Transactions Statement" .xlsx export (Settings → download from
// online banking, one file per month). Unlike SMS alerts — which quote the merchant's original
// foreign-currency amount, converted here with our own fixed FX table — every amount in this
// export is the bank's own already-settled AED figure, so no FX conversion happens here at all.
// This is also the reason it's worth re-importing past months from this format even when SMS
// data already exists for them: it's the source of truth for what was actually charged, and it
// never contains temporary card-authorization holds — those get released before the bank ever
// posts them to a statement, so a hold that shows up in an SMS simply has no row here.
import { readXlsxRows } from './xlsxReader.js'
import { normaliseMerchant } from './merchants.js'
import { DEFAULT_FX_RATES } from '../fx.js'

const MONTH_ABBR = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
}

const STATEMENT_DATE_RE = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/

// "01 Jul 2026" -> "2026-07-01"
function toISODate(text) {
  const match = STATEMENT_DATE_RE.exec(String(text || '').trim())
  if (!match) return null
  const [, day, monthAbbr, year] = match
  const month = MONTH_ABBR[monthAbbr.toLowerCase()]
  if (!month) return null
  return `${year}-${month}-${day.padStart(2, '0')}`
}

function parseAmountCell(value) {
  const cleaned = String(value || '').replace(/,/g, '').replace(/\+/g, '').trim()
  if (!cleaned) return null
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? Math.abs(n) : null
}

const VISA_PURCHASE_RE = /^Visa Purchase\s+\S+\s+\S+\s+\S+\s+(.+?)\s+AED\s+[\d,.]+\s+\S+$/i
const VISA_REFUND_RE = /^Visa Refund\s+\S*?(\d{10,})?(.+)$/i
const IPP_TRANSFER_RE = /^IPP TRANSFER\s+\S+\s+-\s+(.+?)\s+-\s+/i
const SALARY_RE = /^Salary\s+(?:WPS\S*|FUND TRANSFER)?\s*(.*)$/i
const ATM_WITHDRAWAL_RE = /^ATM(?:\/CCDM)?\s+Cash Withdrawal/i
const ATM_DEPOSIT_RE = /^ATM\/CCDM Cash Deposit/i
const ACCT_TO_ACCT_RE = /^Acct to Acct transfer/i
const INWARD_REMITTANCE_RE = /^Inward Remittance/i
const JOINING_BENEFIT_RE = /^Joining Benefit/i
const CASHBACK_RE = /^Funds Transfer\s+EARLY BIRD/i
const IPI_RE = /^IPI transaction/i
const BREACH_MIN_BALANCE_RE = /^Breach of Min Balance/i
const VAT_OUTPUT_RE = /^Value Added Tax/i

// Classifies one statement description into the app's category/ledger/type vocabulary. Exported
// on its own (no xlsx involved) so every rule here has a plain-data test, same as
// categoriseRakDescription in rakCsv.js.
export function categoriseMashreqDescription(description, { isCredit } = {}) {
  const text = String(description || '').trim()

  let m = VISA_PURCHASE_RE.exec(text)
  if (m) {
    return { rawMerchant: m[1].trim(), type: 'expense', category: 'Personal expenses', ledger: 'personal', ruleId: 'STMT_VISA_PURCHASE' }
  }

  m = VISA_REFUND_RE.exec(text)
  if (m) {
    return { rawMerchant: (m[2] || text.replace(/^Visa Refund\s*/i, '')).trim(), type: 'refund', category: 'Refund', ledger: 'income', ruleId: 'STMT_VISA_REFUND' }
  }

  m = IPP_TRANSFER_RE.exec(text)
  if (m) {
    return { rawMerchant: `Transfer to ${m[1].trim()}`, type: 'expense', category: 'Personal expenses', ledger: 'personal', ruleId: 'STMT_IPP_TRANSFER' }
  }

  if (ACCT_TO_ACCT_RE.test(text)) {
    return { rawMerchant: 'Account transfer', type: 'transfer', category: 'Transfer', ledger: 'personal', ruleId: 'STMT_ACCT_TO_ACCT' }
  }

  m = SALARY_RE.exec(text)
  if (m) {
    return { rawMerchant: m[1].trim() || 'Salary', type: 'income', category: 'Salary – Beno', ledger: 'income', ruleId: 'STMT_SALARY' }
  }

  if (ATM_WITHDRAWAL_RE.test(text)) {
    return { rawMerchant: 'ATM Cash Withdrawal', type: 'expense', category: 'Cash Withdrawal', ledger: 'personal', ruleId: 'STMT_ATM_WITHDRAWAL' }
  }

  if (ATM_DEPOSIT_RE.test(text)) {
    return { rawMerchant: 'Cash deposit', type: 'transfer', category: 'Transfer', ledger: 'personal', ruleId: 'STMT_ATM_DEPOSIT' }
  }

  if (INWARD_REMITTANCE_RE.test(text)) {
    return { rawMerchant: 'Inward remittance', type: 'income', category: 'Other Income', ledger: 'income', ruleId: 'STMT_INWARD_REMITTANCE' }
  }

  if (JOINING_BENEFIT_RE.test(text)) {
    return { rawMerchant: 'Bank bonus', type: 'income', category: 'Bank Bonus', ledger: 'income', ruleId: 'STMT_JOINING_BENEFIT' }
  }

  if (CASHBACK_RE.test(text)) {
    return { rawMerchant: 'Cashback', type: 'income', category: 'Bank Bonus', ledger: 'income', ruleId: 'STMT_CASHBACK' }
  }

  if (IPI_RE.test(text)) {
    return { rawMerchant: 'Wallet cash-out', type: 'income', category: 'Transfer In', ledger: 'income', ruleId: 'STMT_IPI' }
  }

  if (BREACH_MIN_BALANCE_RE.test(text) || VAT_OUTPUT_RE.test(text)) {
    return { rawMerchant: 'Bank fee', type: 'expense', category: 'Personal expenses', ledger: 'personal', ruleId: 'STMT_BANK_FEE' }
  }

  return {
    rawMerchant: text.slice(0, 80) || 'Mashreq transaction',
    type: isCredit ? 'income' : 'expense',
    category: isCredit ? 'Other Income' : 'Personal expenses',
    ledger: isCredit ? 'income' : 'personal',
    ruleId: 'STMT_UNRECOGNISED'
  }
}

// Maps already-extracted worksheet rows (as returned by readXlsxRows) into the app's normalised
// transaction-row shape. Kept separate from the .xlsx/zip reading so the mapping rules can be
// tested with plain arrays, no binary fixture required.
export function parseMashreqStatementRows(rows) {
  const results = []

  for (const row of rows) {
    const [dateCell, , refCell, descriptionCell, creditCell, debitCell] = row
    const date = toISODate(dateCell)
    if (!date) continue // header/metadata row, not a transaction

    const credit = parseAmountCell(creditCell)
    const debit = parseAmountCell(debitCell)
    if (credit === null && debit === null) continue

    const isCredit = credit !== null
    const amount = isCredit ? credit : debit
    const description = String(descriptionCell || '').replace(/\s+/g, ' ').trim()
    const classified = categoriseMashreqDescription(description, { isCredit })

    results.push({
      ruleId: classified.ruleId,
      date,
      rawMerchant: classified.rawMerchant,
      merchant: normaliseMerchant(classified.rawMerchant) || classified.rawMerchant,
      amount,
      currency: 'AED',
      fxRate: 1,
      fxAmount: amount,
      type: classified.type,
      paymentMethod: 'Mashreq Debit 9437',
      ledger: classified.ledger,
      category: classified.type === 'transfer' ? 'Transfer' : classified.category,
      bankRef: String(refCell || '').trim() || null,
      notes: description,
      sourceLine: description
    })
  }

  return results
}

// The actual import-flow entry point: reads the .xlsx binary and maps it in one call.
// `fxRates` is accepted for interface symmetry with the other parsers but unused — every amount
// here is already the bank's own settled AED figure.
export async function parseMashreqStatementFile(arrayBuffer, { fxRates = DEFAULT_FX_RATES } = {}) {
  void fxRates
  const rows = await readXlsxRows(arrayBuffer)
  return parseMashreqStatementRows(rows)
}
