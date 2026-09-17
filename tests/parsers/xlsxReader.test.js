import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readXlsxRows } from '../../src/lib/parsers/xlsxReader.js'
import { parseMashreqStatementFile } from '../../src/lib/parsers/mashreqStatement.js'

function fixtureArrayBuffer() {
  const buffer = readFileSync(join(process.cwd(), 'tests/fixtures/mashreq_statement_sample.xlsx'))
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
}

describe('readXlsxRows', () => {
  it('reads the header metadata block and the transaction rows out of a real .xlsx file', async () => {
    const rows = await readXlsxRows(fixtureArrayBuffer())
    const headerRow = rows.find((r) => r[0] === 'Date' && r[3] === 'Description')
    expect(headerRow).toBeTruthy()

    const txnRow = rows.find((r) => String(r[2]) === 'FIXREF001')
    expect(txnRow[0]).toBe('01 Jul 2026')
    expect(txnRow[3]).toContain('TEST SUPERMARKET')
    expect(parseFloat(txnRow[5])).toBe(-25)
  })
})

describe('parseMashreqStatementFile', () => {
  it('reads a real .xlsx end-to-end into normalised transaction rows', async () => {
    const results = await parseMashreqStatementFile(fixtureArrayBuffer())
    expect(results).toHaveLength(2)
    expect(results[0]).toMatchObject({ date: '2026-07-01', amount: 25, type: 'expense', bankRef: 'FIXREF001' })
    expect(results[1]).toMatchObject({ date: '2026-07-02', amount: 5000, type: 'income', category: 'Salary – Beno' })
  })
})
