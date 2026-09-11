import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseRakCsv } from '../../src/lib/parsers/rakCsv.js'

const fixture = readFileSync(join(process.cwd(), 'tests/fixtures/Account_Transactions_CSV_202603.csv'), 'utf8')

describe('parseRakCsv', () => {
  const rows = parseRakCsv(fixture)

  it('skips the metadata header block and parses only real data rows', () => {
    expect(rows).toHaveLength(6)
  })

  it('maps "CHARGE COLLECTION … INCL VAT" to LH – Bank Fees with computed input VAT', () => {
    expect(rows[0]).toMatchObject({
      date: '2026-03-10',
      amount: 103.95,
      type: 'expense',
      ledger: 'lh_business',
      category: 'LH – Bank Fees',
      inputVat: 4.95,
      reclaimable: true,
      bankRef: 'REF003'
    })
  })

  it('maps "RAKvalue Monthly Fee" to LH – Bank Fees with computed input VAT', () => {
    expect(rows[1]).toMatchObject({
      amount: 51.45,
      category: 'LH – Bank Fees',
      inputVat: 2.45,
      reclaimable: true
    })
  })

  it('maps an outward transfer to the Federal Tax Authority to LH – VAT', () => {
    expect(rows[2]).toMatchObject({
      amount: 500,
      type: 'expense',
      category: 'LH – VAT',
      reclaimable: false
    })
  })

  it('maps "PURCHASE TRXN.-REV" to a refund even though it lands in the credit column', () => {
    expect(rows[3]).toMatchObject({ amount: 120, type: 'refund' })
  })

  it('joins a quoted multiline description into a single normalised string', () => {
    expect(rows[4].rawMerchant).toBe('Supplier payment Mar 2026 XYZ Productions')
    expect(rows[4]).toMatchObject({ amount: 1000, type: 'expense' })
  })

  it('reads the debit column as expense and the credit column as income by default', () => {
    expect(rows[4].type).toBe('expense')
    expect(rows[5]).toMatchObject({ amount: 2000, type: 'income' })
  })
})
