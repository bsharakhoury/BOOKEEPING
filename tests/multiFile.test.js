import { describe, expect, it } from 'vitest'
import { mergeParsedFiles } from '../src/lib/parsers/multiFile.js'

const row = (overrides) => ({ date: '2026-06-01', amount: 100, type: 'expense', rawMerchant: 'RAK Bank – Account maintenance', balanceAfter: 500, bankRef: null, ...overrides })
const file = (name, rows, parserId = 'rakTxt') => ({ fileName: name, parserId, label: 'RAK Bank (statement .txt)', rows })

describe('mergeParsedFiles', () => {
  it('combines rows from several files of the same kind, newest first', () => {
    const merged = mergeParsedFiles([file('a.txt', [row({ date: '2026-05-01', balanceAfter: 1 })]), file('b.txt', [row({ date: '2026-07-01', balanceAfter: 2 })])])
    expect(merged.rows.map((r) => r.date)).toEqual(['2026-07-01', '2026-05-01'])
    expect(merged.sourceName).toBe('2 files')
    expect(merged.parserId).toBe('rakTxt')
  })

  it('drops a row repeated by an overlapping file (same date, amount, text and running balance)', () => {
    const merged = mergeParsedFiles([file('long.txt', [row()]), file('month.txt', [row()])])
    expect(merged.rows).toHaveLength(1)
    expect(merged.duplicatesDropped).toBe(1)
  })

  it('keeps two identical charges on the same day, because their running balances differ', () => {
    const merged = mergeParsedFiles([file('a.txt', [row({ amount: 1.05, balanceAfter: 10 }), row({ amount: 1.05, balanceAfter: 8.95 })])])
    expect(merged.rows).toHaveLength(2)
  })

  it('never drops a row it has no balance or reference to compare', () => {
    const merged = mergeParsedFiles([file('a', [row({ balanceAfter: undefined })]), file('b', [row({ balanceAfter: undefined })])])
    expect(merged.rows).toHaveLength(2)
  })

  it('uses the file name as the source when there is only one file', () => {
    expect(mergeParsedFiles([file('only.txt', [row()])]).sourceName).toBe('only.txt')
  })

  it('refuses to mix different kinds of statement in one import', () => {
    expect(() => mergeParsedFiles([file('a.txt', [row()]), file('b.xlsx', [row()], 'mashreqStatement')])).toThrow(/different kinds/)
  })
})
