// Parses RAK Bank transaction text pasted from online banking (as opposed to the
// Account_Transactions_CSV upload — see rakCsv.js). No sample was provided, so this assumes the
// common three-line-per-transaction shape produced by copying a transaction list out of a web
// table: a date line, one or more description lines, then an "AED amount DR/CR" line, with a
// blank line between transactions. Shares its bank-vocabulary categorisation rules with
// rakCsv.js since the same description strings appear either way.
import { categoriseRakDescription } from './rakCsv.js'

const MONTH_ABBR = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
}

const DATE_LINE_RE = /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/
const AMOUNT_LINE_RE = /^AED\s?([\d,]+\.\d{2})\s+(DR|CR)$/i

function toISO(day, monthName, year) {
  const month = MONTH_ABBR[monthName.toLowerCase().slice(0, 3)]
  if (!month) return null
  return `${year}-${month}-${String(day).padStart(2, '0')}`
}

export function parseRakStatement(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.trim())

  const rows = []
  let pendingDate = null
  let descriptionLines = []

  for (const line of lines) {
    if (!line) continue

    const dateMatch = DATE_LINE_RE.exec(line)
    if (dateMatch) {
      const iso = toISO(dateMatch[1], dateMatch[2], dateMatch[3])
      if (iso) {
        pendingDate = iso
        descriptionLines = []
        continue
      }
    }

    const amountMatch = AMOUNT_LINE_RE.exec(line)
    if (amountMatch && pendingDate) {
      const amount = parseFloat(amountMatch[1].replace(/,/g, ''))
      const direction = amountMatch[2].toUpperCase()
      const description = descriptionLines.join(' ').replace(/\s+/g, ' ').trim()
      const { category, inputVat, reclaimable, typeOverride } = categoriseRakDescription(description, amount)

      rows.push({
        ruleId: 'RAK_STATEMENT',
        date: pendingDate,
        rawMerchant: description || 'RAK Bank transaction',
        merchant: description || 'RAK Bank transaction',
        amount,
        currency: 'AED',
        fxRate: 1,
        fxAmount: amount,
        type: typeOverride || (direction === 'DR' ? 'expense' : 'income'),
        paymentMethod: 'RAK Bank',
        ledger: 'lh_business',
        category,
        inputVat,
        reclaimable,
        bankRef: null,
        notes: description,
        sourceLine: `${pendingDate} | ${description} | AED ${amountMatch[1]} ${direction}`
      })

      pendingDate = null
      descriptionLines = []
      continue
    }

    if (pendingDate) {
      descriptionLines.push(line)
    }
  }

  return rows
}
