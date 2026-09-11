import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseRakStatement } from '../../src/lib/parsers/rakStatement.js'

const fixture = readFileSync(join(process.cwd(), 'tests/fixtures/rakStatement.txt'), 'utf8')

describe('parseRakStatement', () => {
  const rows = parseRakStatement(fixture)

  it('parses one transaction per date/description/amount block', () => {
    expect(rows).toHaveLength(4)
  })

  it('maps "CHARGE COLLECTION … INCL VAT" to LH – Bank Fees with computed input VAT, same as the CSV parser', () => {
    expect(rows[0]).toMatchObject({
      date: '2026-03-10',
      amount: 103.95,
      type: 'expense',
      category: 'LH – Bank Fees',
      inputVat: 4.95,
      reclaimable: true
    })
  })

  it('maps RAKvalue Monthly Fee to LH – Bank Fees', () => {
    expect(rows[1]).toMatchObject({ amount: 51.45, category: 'LH – Bank Fees', inputVat: 2.45 })
  })

  it('joins a multi-line description and maps the outward T/T to LH – VAT', () => {
    expect(rows[2].rawMerchant).toBe('OUTWARD T/T TO Federal tax authority VAT PAYMENT')
    expect(rows[2]).toMatchObject({ amount: 500, type: 'expense', category: 'LH – VAT' })
  })

  it('reads a CR line as income', () => {
    expect(rows[3]).toMatchObject({ date: '2026-03-28', amount: 2000, type: 'income', category: 'LH – Other' })
  })
})
