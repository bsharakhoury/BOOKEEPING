// Parses pasted Mashreq Bank SMS alerts. No sample SMS text was provided, so the exact wording
// below is a documented best guess at real Mashreq phrasing — grounded in two hard constraints
// from the brief: the in-sentence date reads "on Monday, 10 August 2026, 1:26 pm", and every
// format includes an "Available Balance" figure that must never be read as the transaction
// amount. Each recognised format below is one rule (P_MASHREQ_DEBIT, P_NEO_VISA, P_ACCOUNT,
// Aani debit/credit, salary credit), each with its own fixture + test.
import { isDateOnlyLine, parseLongDate, todayISO } from '../dates.js'
import { normaliseMerchant } from './merchants.js'
import { DEFAULT_FX_RATES } from '../fx.js'

const CARD_ACCOUNTS = { 9437: 'Mashreq Debit 9437', 8777: 'Mashreq Credit 8777' }

function accountForLast4(last4) {
  return CARD_ACCOUNTS[last4] || 'Mashreq Transfer'
}

function round2(value) {
  return Math.round(value * 100) / 100
}

function parseAmount(currencyCode, rawAmount, fxRates) {
  const foreignAmount = parseFloat(String(rawAmount).replace(/,/g, ''))
  if (currencyCode === 'AED') {
    return { amount: foreignAmount, currency: 'AED', fxRate: 1, fxAmount: foreignAmount }
  }
  const rate = fxRates[currencyCode] || 1
  return { amount: round2(foreignAmount * rate), currency: currencyCode, fxRate: rate, fxAmount: foreignAmount }
}

// Every capture ends with an optional " on <rest of sentence>" tail so the same regex matches
// whether the date is in-sentence or the line inherited a header date (and so has no "on …"
// clause at all — the line just ends after the merchant/description).
const DEBIT_CARD_RE = /^Purchase with Debit Card ending (\d{4}) for (AED|USD|EUR|GBP)\s?([\d,]+\.\d{2}) at (.+?)(?:\s+on\s+.+)?$/i
const NEO_VISA_RE = /^Purchase with Neo Visa Credit Card ending (\d{4}) for (AED|USD|EUR|GBP)\s?([\d,]+\.\d{2}) at (.+?)(?:\s+on\s+.+)?$/i
const AANI_DEBIT_RE = /^AED\s?([\d,]+\.\d{2}) has been debited from your account ending (\d{4}) via Aani to (.+?)(?:\s+on\s+.+)?$/i
const AANI_CREDIT_RE = /^AED\s?([\d,]+\.\d{2}) has been credited to your account ending (\d{4}) via Aani from (.+?)(?:\s+on\s+.+)?$/i
const SALARY_RE = /^Salary of AED\s?([\d,]+\.\d{2}) has been credited to your account ending (\d{4}) from (.+?)(?:\s+on\s+.+)?$/i
const ACCOUNT_RE = /^Your account ending (\d{4}) has been (debited|credited) with AED\s?([\d,]+\.\d{2}) for (.+?)(?:\s+on\s+.+)?$/i

function matchLine(line, fxRates) {
  let m = DEBIT_CARD_RE.exec(line)
  if (m) {
    const [, last4, currencyCode, rawAmount, merchant] = m
    return {
      ruleId: 'P_MASHREQ_DEBIT',
      rawMerchant: merchant.trim(),
      type: 'expense',
      paymentMethod: accountForLast4(last4),
      category: 'Personal expenses',
      ledger: 'personal',
      ...parseAmount(currencyCode.toUpperCase(), rawAmount, fxRates)
    }
  }

  m = NEO_VISA_RE.exec(line)
  if (m) {
    const [, last4, currencyCode, rawAmount, merchant] = m
    return {
      ruleId: 'P_NEO_VISA',
      rawMerchant: merchant.trim(),
      type: 'expense',
      paymentMethod: accountForLast4(last4),
      category: 'Personal expenses',
      ledger: 'personal',
      ...parseAmount(currencyCode.toUpperCase(), rawAmount, fxRates)
    }
  }

  m = AANI_DEBIT_RE.exec(line)
  if (m) {
    const [, rawAmount, , recipient] = m
    return {
      ruleId: 'P_AANI_DEBIT',
      rawMerchant: `Aani transfer to ${recipient.trim()}`,
      type: 'expense',
      paymentMethod: 'Mashreq Transfer',
      category: 'Personal expenses',
      ledger: 'personal',
      ...parseAmount('AED', rawAmount, fxRates)
    }
  }

  m = AANI_CREDIT_RE.exec(line)
  if (m) {
    const [, rawAmount, , sender] = m
    return {
      ruleId: 'P_AANI_CREDIT',
      rawMerchant: `Aani transfer from ${sender.trim()}`,
      type: 'income',
      paymentMethod: 'Mashreq Transfer',
      category: 'Transfer In',
      ledger: 'income',
      ...parseAmount('AED', rawAmount, fxRates)
    }
  }

  m = SALARY_RE.exec(line)
  if (m) {
    const [, rawAmount, last4, employer] = m
    return {
      ruleId: 'P_SALARY',
      rawMerchant: employer.trim() || 'Salary',
      type: 'income',
      paymentMethod: accountForLast4(last4),
      category: 'Salary – Beno',
      ledger: 'income',
      ...parseAmount('AED', rawAmount, fxRates)
    }
  }

  m = ACCOUNT_RE.exec(line)
  if (m) {
    const [, last4, direction, rawAmount, description] = m
    const debited = direction.toLowerCase() === 'debited'
    return {
      ruleId: 'P_ACCOUNT',
      rawMerchant: description.trim(),
      type: debited ? 'expense' : 'income',
      paymentMethod: accountForLast4(last4),
      category: debited ? 'Personal expenses' : 'Other Income',
      ledger: debited ? 'personal' : 'income',
      ...parseAmount('AED', rawAmount, fxRates)
    }
  }

  return null
}

export function parseMashreqSms(text, { fxRates = DEFAULT_FX_RATES } = {}) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const rows = []
  let headerDate = null

  for (const line of lines) {
    if (isDateOnlyLine(line)) {
      headerDate = parseLongDate(line)
      continue
    }

    // "Available Balance …" must never be read as the transaction amount — strip it before
    // any amount-matching regex runs.
    const withoutBalance = line.replace(/Available Balance.*/i, '').trim()
    const prepared = withoutBalance.replace(/\.+$/, '').trim()
    const matched = matchLine(prepared, fxRates)
    if (!matched) continue

    const date = parseLongDate(withoutBalance) || headerDate || todayISO()

    rows.push({
      date,
      merchant: normaliseMerchant(matched.rawMerchant),
      currency: matched.currency,
      fxRate: matched.fxRate,
      fxAmount: matched.fxAmount,
      amount: matched.amount,
      type: matched.type,
      paymentMethod: matched.paymentMethod,
      category: matched.category,
      ledger: matched.ledger,
      rawMerchant: matched.rawMerchant,
      ruleId: matched.ruleId,
      bankRef: null,
      notes: '',
      sourceLine: line
    })
  }

  return rows
}
