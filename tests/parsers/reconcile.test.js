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

describe('reconcileStatementRows — amount mode (RAK)', () => {
  const options = { accounts: new Set(['RAK Bank']), matchBy: 'amount', dayWindow: 10 }
  const bankRow = (overrides) => ({ date: '2026-04-09', rawMerchant: 'Transfer to owner', amount: 1000, type: 'transfer', direction: 'out', bankRef: null, notes: '', ...overrides })
  const appTxn = (overrides) => ({ id: 'a1', date: '2026-04-09', amount: 1000, merchant: 'LH - Inward remittance Apr', paymentMethod: 'RAK Bank', type: 'income', ...overrides })

  it('pairs rows by identical amount and direction, ignoring merchant wording, and corrects the date', () => {
    const existing = appTxn({ type: 'expense', date: '2026-04-12', merchant: 'Owner draw' })
    const result = reconcileStatementRows([bankRow()], [existing], options)
    expect(result.updates).toHaveLength(1)
    expect(result.updates[0].after.date).toBe('2026-04-09')
    expect(result.additions).toHaveLength(0)
    expect(result.flagged).toHaveLength(0)
  })

  it('does not pair an income entry with an outgoing bank row of the same amount (wrong direction)', () => {
    const result = reconcileStatementRows([bankRow()], [appTxn()], options)
    expect(result.additions).toHaveLength(1)
    expect(result.flagged.map((t) => t.id)).toEqual(['a1'])
  })

  it('pairs a transfer that has no direction recorded with a bank row of either direction', () => {
    const result = reconcileStatementRows([bankRow()], [appTxn({ type: 'transfer' })], options)
    expect(result.additions).toHaveLength(0)
  })

  it('does not pair entries further apart than the day window', () => {
    const result = reconcileStatementRows([bankRow()], [appTxn({ type: 'expense', date: '2026-04-25' })], options)
    expect(result.additions).toHaveLength(1)
  })

  it('only considers the configured account', () => {
    const result = reconcileStatementRows([bankRow()], [appTxn({ type: 'expense', paymentMethod: 'Mashreq Debit 9437' })], options)
    expect(result.flagged).toHaveLength(0)
    expect(result.additions).toHaveLength(1)
  })

  it('does not flag app entries dated outside the statement period', () => {
    const outside = appTxn({ id: 'old', date: '2025-01-01', type: 'expense' })
    const result = reconcileStatementRows([bankRow()], [outside], options)
    expect(result.flagged).toHaveLength(0)
  })

  it('uses each existing entry at most once when two bank rows share an amount', () => {
    const rows = [bankRow({ date: '2026-04-09' }), bankRow({ date: '2026-04-10' })]
    const result = reconcileStatementRows(rows, [appTxn({ type: 'expense' })], options)
    expect(result.matches).toHaveLength(1)
    expect(result.additions).toHaveLength(1)
  })
})
