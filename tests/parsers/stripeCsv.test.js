import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseStripeCsv } from '../../src/lib/parsers/stripeCsv.js'

const fixture = readFileSync(join(process.cwd(), 'tests/fixtures/stripe_balance_history.csv'), 'utf8')

describe('parseStripeCsv', () => {
  const rows = parseStripeCsv(fixture)

  it('splits each charge into an income row plus a separate fee row', () => {
    expect(rows).toHaveLength(5) // 2 charges x (income + fee) + 1 payout
  })

  it('maps a charge to Leaf & Hook – Wellness income', () => {
    expect(rows[0]).toMatchObject({
      date: '2026-03-28',
      amount: 255,
      type: 'income',
      ledger: 'income', // all income uses the 'income' ledger app-wide — 'lh_business' is for L&H's own expense activity
      category: 'Leaf & Hook – Wellness',
      ruleId: 'STRIPE_SESSION'
    })
  })

  it("maps the charge's fee to a separate LH – Bank Fees expense", () => {
    expect(rows[1]).toMatchObject({
      date: '2026-03-28',
      amount: 7.65,
      type: 'expense',
      category: 'LH – Bank Fees',
      ruleId: 'STRIPE_FEE'
    })
  })

  it('maps a payout to a transfer, excluded from income/expense categorisation', () => {
    const payout = rows.find((r) => r.ruleId === 'STRIPE_PAYOUT')
    expect(payout).toMatchObject({ date: '2026-04-02', amount: 850, type: 'transfer', category: 'Transfer' })
  })
})
