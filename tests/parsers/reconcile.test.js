import { describe, expect, it } from 'vitest'
import { reconcileStatementRows } from '../../src/lib/parsers/reconcile.js'

function statementRow(overrides) {
  return { date: '2026-07-15', rawMerchant: 'CAREEM FOOD, Dubai', amount: 40.75, bankRef: 'REF1', notes: '', ...overrides }
}

function existingTxn(overrides) {
  return { id: 'e1', date: '2026-07-20', amount: 40.75, merchant: 'Careem Food', rawMerchant: 'CAREEM FOOD, Dubai', paymentMethod: 'Mashreq Debit 9437', ...overrides }
}

describe('reconcileStatementRows', () => {
  it('matches by month + merchant overlap and proposes a date/amount correction', () => {
    const result = reconcileStatementRows([statementRow()], [existingTxn()])
    expect(result.updates).toHaveLength(1)
    expect(result.updates[0]).toMatchObject({
      id: 'e1',
      before: { date: '2026-07-20', amount: 40.75 },
      after: { date: '2026-07-15', amount: 40.75 }
    })
    expect(result.additions).toHaveLength(0)
    expect(result.flagged).toHaveLength(0)
  })

  it('does not propose an update when date and amount already match exactly', () => {
    const result = reconcileStatementRows([statementRow({ date: '2026-07-20' })], [existingTxn({ date: '2026-07-20' })])
    expect(result.updates).toHaveLength(0)
  })

  it('treats an amount-drifted subscription as a correction, not a duplicate addition', () => {
    const row = statementRow({ rawMerchant: 'SPOTIFY P3E86D7BF3 AED STOCKHOLM', amount: 24.57 })
    const existing = existingTxn({ rawMerchant: 'Spotify P3E86D7BF3', merchant: 'Spotify', amount: 23.99 })
    const result = reconcileStatementRows([row], [existing])
    expect(result.additions).toHaveLength(0)
    expect(result.updates).toHaveLength(1)
    expect(result.updates[0].after.amount).toBe(24.57)
  })

  it('adds a statement row with no merchant/month match as a genuinely new transaction', () => {
    const row = statementRow({ rawMerchant: 'BRAND NEW MERCHANT LLC' })
    const result = reconcileStatementRows([row], [existingTxn()])
    expect(result.additions).toHaveLength(1)
    expect(result.updates).toHaveLength(0)
  })

  it('flags an existing entry that no statement row claims (a candidate phantom hold)', () => {
    const holdTxn = existingTxn({ id: 'hold1', rawMerchant: 'GOOGLE CHROME TEMP', merchant: 'Google Chrome Temp', amount: 4 })
    const result = reconcileStatementRows([statementRow()], [existingTxn(), holdTxn])
    expect(result.flagged).toHaveLength(1)
    expect(result.flagged[0].id).toBe('hold1')
  })

  it('ignores existing transactions on unrelated accounts entirely', () => {
    const rakTxn = existingTxn({ id: 'rak1', paymentMethod: 'RAK Bank' })
    const result = reconcileStatementRows([statementRow()], [rakTxn])
    expect(result.flagged).toHaveLength(0)
    expect(result.additions).toHaveLength(1) // nothing to match against, so it's a new addition
  })

  it('ignores existing transactions outside any month the statement covers', () => {
    const otherMonthTxn = existingTxn({ id: 'e2', date: '2026-01-05' })
    const result = reconcileStatementRows([statementRow()], [otherMonthTxn])
    expect(result.flagged).toHaveLength(0)
  })

  it('never matches the same existing transaction to two different statement rows', () => {
    const rows = [statementRow({ bankRef: 'A' }), statementRow({ bankRef: 'B', date: '2026-07-16' })]
    const result = reconcileStatementRows(rows, [existingTxn()])
    expect(result.updates.length + result.additions.length).toBe(2)
    // only one of the two rows can have consumed the single existing transaction
    expect(result.updates).toHaveLength(1)
    expect(result.additions).toHaveLength(1)
  })
})
