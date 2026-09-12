import { describe, expect, it, vi } from 'vitest'
import { pushTransactionsToSheet, transactionsToRows } from '../src/lib/googleSheetsSync.js'

describe('transactionsToRows', () => {
  it('puts a header row first, then one row per transaction, newest date first', () => {
    const transactions = [
      { id: 'a', date: '2026-08-01', merchant: 'Carrefour', category: 'Food (Groceries)', ledger: 'personal', type: 'expense', amount: 50, paymentMethod: 'Mashreq Debit 9437', notes: '' },
      { id: 'b', date: '2026-09-01', merchant: 'Salary', category: 'Salary – Beno', ledger: 'income', type: 'income', amount: 15000, paymentMethod: 'Mashreq Debit 9437', notes: 'monthly' }
    ]
    const rows = transactionsToRows(transactions)
    expect(rows[0]).toEqual(['ID', 'Date', 'Merchant', 'Category', 'Ledger', 'Type', 'Amount', 'Account', 'Notes'])
    expect(rows[1]).toEqual(['b', '2026-09-01', 'Salary', 'Salary – Beno', 'income', 'income', 15000, 'Mashreq Debit 9437', 'monthly'])
    expect(rows[2]).toEqual(['a', '2026-08-01', 'Carrefour', 'Food (Groceries)', 'personal', 'expense', 50, 'Mashreq Debit 9437', ''])
  })

  it('returns just the header for an empty list', () => {
    expect(transactionsToRows([])).toEqual([['ID', 'Date', 'Merchant', 'Category', 'Ledger', 'Type', 'Amount', 'Account', 'Notes']])
  })
})

describe('pushTransactionsToSheet', () => {
  it('clears the sheet then writes the current transactions, using the access token as a bearer header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true })
    const transactions = [{ id: 'a', date: '2026-09-01', merchant: 'Test', category: 'Home', ledger: 'personal', type: 'expense', amount: 10 }]

    const result = await pushTransactionsToSheet({ accessToken: 'token-123', sheetId: 'sheet-abc', transactions, fetchImpl })

    expect(result).toEqual({ rowCount: 1 })
    expect(fetchImpl).toHaveBeenCalledTimes(2)

    const [clearUrl, clearOptions] = fetchImpl.mock.calls[0]
    expect(clearUrl).toContain('sheet-abc/values/Transactions!A:Z:clear')
    expect(clearOptions.headers.Authorization).toBe('Bearer token-123')

    const [updateUrl, updateOptions] = fetchImpl.mock.calls[1]
    expect(updateUrl).toContain('sheet-abc/values/Transactions!A1')
    expect(updateOptions.method).toBe('PUT')
    const body = JSON.parse(updateOptions.body)
    expect(body.values).toHaveLength(2) // header + 1 row
  })

  it('throws when the clear request fails, without attempting the write', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 403 })
    await expect(pushTransactionsToSheet({ accessToken: 't', sheetId: 's', transactions: [], fetchImpl })).rejects.toThrow('403')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('throws when the write request fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, status: 500 })
    await expect(pushTransactionsToSheet({ accessToken: 't', sheetId: 's', transactions: [], fetchImpl })).rejects.toThrow('500')
  })
})
