import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { detect } from '../../src/lib/parsers/index.js'

const mashreqText = readFileSync(join(process.cwd(), 'tests/fixtures/mashreqSms.txt'), 'utf8')
const rakStatementText = readFileSync(join(process.cwd(), 'tests/fixtures/rakStatement.txt'), 'utf8')
const rakCsvText = readFileSync(join(process.cwd(), 'tests/fixtures/Account_Transactions_CSV_202603.csv'), 'utf8')
const stripeCsvText = readFileSync(join(process.cwd(), 'tests/fixtures/stripe_balance_history.csv'), 'utf8')

describe('detect', () => {
  it('picks the Mashreq SMS parser for pasted SMS text', () => {
    expect(detect({ text: mashreqText }).id).toBe('mashreqSms')
  })

  it('picks the RAK statement parser for pasted statement text', () => {
    expect(detect({ text: rakStatementText }).id).toBe('rakStatement')
  })

  it('picks the RAK CSV parser by filename', () => {
    expect(detect({ text: rakCsvText, fileName: 'Account_Transactions_CSV_202603.csv' }).id).toBe('rakCsv')
  })

  it('picks the RAK CSV parser by content when the filename is generic', () => {
    expect(detect({ text: rakCsvText, fileName: 'export.csv' }).id).toBe('rakCsv')
  })

  it('picks the Stripe CSV parser by header shape', () => {
    expect(detect({ text: stripeCsvText, fileName: 'balance_history.csv' }).id).toBe('stripeCsv')
  })

  it('returns null for unrecognised input', () => {
    expect(detect({ text: 'just some random notes' })).toBeNull()
  })
})
