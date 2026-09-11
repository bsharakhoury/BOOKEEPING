import { parseMashreqSms } from './mashreqSms.js'
import { parseRakStatement } from './rakStatement.js'
import { parseRakCsv } from './rakCsv.js'
import { parseStripeCsv } from './stripeCsv.js'

const MASHREQ_SMS_HINT_RE = /purchase with (debit card|neo visa)|has been debited|has been credited|salary of aed/i
const RAK_STATEMENT_HINT_RE = /^\d{1,2}\s+[a-z]{3,}\s+\d{4}/i

// Paste box + .csv upload → detect() picks the parser. CSV files are told apart by filename
// first (RAK's own export naming), then by header shape; pasted text is told apart by phrasing.
export function detect({ text = '', fileName = '' } = {}) {
  const trimmedText = String(text).trim()
  const lowerName = String(fileName).toLowerCase()
  const firstLine = (trimmedText.split(/\r?\n/)[0] || '').toLowerCase()

  if (lowerName.endsWith('.csv') || fileName) {
    if (lowerName.includes('account_transactions_csv')) {
      return { id: 'rakCsv', label: 'RAK Bank (CSV)', parse: parseRakCsv }
    }
    if (firstLine.includes('type') && firstLine.includes('fee') && firstLine.includes('amount')) {
      return { id: 'stripeCsv', label: 'Stripe (CSV)', parse: parseStripeCsv }
    }
    if (/post date|value date|card\/ref/i.test(trimmedText)) {
      return { id: 'rakCsv', label: 'RAK Bank (CSV)', parse: parseRakCsv }
    }
    if (fileName) return null // an uploaded file we don't recognise
  }

  if (MASHREQ_SMS_HINT_RE.test(trimmedText)) {
    return { id: 'mashreqSms', label: 'Mashreq SMS', parse: parseMashreqSms }
  }
  if (RAK_STATEMENT_HINT_RE.test(trimmedText)) {
    return { id: 'rakStatement', label: 'RAK Bank (statement text)', parse: parseRakStatement }
  }

  return null
}
