import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseMashreqSms } from '../../src/lib/parsers/mashreqSms.js'

const fixture = readFileSync(join(process.cwd(), 'tests/fixtures/mashreqSms.txt'), 'utf8')

describe('parseMashreqSms', () => {
  const rows = parseMashreqSms(fixture)

  it('parses every recognised line, ignoring blank lines and pure date headers', () => {
    expect(rows).toHaveLength(11)
  })

  it('parses a domestic debit card purchase (P_MASHREQ_DEBIT) with the in-sentence date', () => {
    expect(rows[0]).toMatchObject({
      date: '2026-08-10',
      rawMerchant: 'CAREEM QUIK, Abu Dhabi',
      merchant: 'Careem Quik',
      amount: 35.26,
      currency: 'AED',
      fxRate: 1,
      fxAmount: 35.26,
      type: 'expense',
      paymentMethod: 'Mashreq Debit 9437',
      category: 'Personal expenses',
      ledger: 'personal',
      ruleId: 'P_MASHREQ_DEBIT'
    })
  })

  it('converts a foreign-currency debit purchase using the Settings FX rate', () => {
    expect(rows[1]).toMatchObject({
      date: '2026-08-11',
      merchant: 'Distrokid Musician',
      currency: 'USD',
      fxRate: 3.674,
      fxAmount: 24.99,
      amount: 91.81,
      type: 'expense'
    })
  })

  it('parses a Neo Visa credit card purchase (P_NEO_VISA)', () => {
    expect(rows[2]).toMatchObject({
      date: '2026-08-12',
      merchant: 'Squarespace Inc',
      amount: 91.71,
      paymentMethod: 'Mashreq Credit 8777',
      ruleId: 'P_NEO_VISA'
    })
  })

  it('parses an Aani debit as a personal expense', () => {
    expect(rows[3]).toMatchObject({
      date: '2026-08-13',
      amount: 200,
      type: 'expense',
      paymentMethod: 'Mashreq Transfer',
      category: 'Personal expenses',
      ledger: 'personal',
      ruleId: 'P_AANI_DEBIT'
    })
  })

  it('parses an Aani credit as Transfer In income', () => {
    expect(rows[4]).toMatchObject({
      date: '2026-08-14',
      amount: 400,
      type: 'income',
      paymentMethod: 'Mashreq Transfer',
      category: 'Transfer In',
      ledger: 'income',
      ruleId: 'P_AANI_CREDIT'
    })
  })

  it('parses a salary credit', () => {
    expect(rows[5]).toMatchObject({
      date: '2026-08-15',
      amount: 15000,
      type: 'income',
      paymentMethod: 'Mashreq Debit 9437',
      category: 'Salary – Beno',
      ledger: 'income',
      ruleId: 'P_SALARY'
    })
  })

  it('parses a generic account debit/credit (P_ACCOUNT) and never mistakes Available Balance for the amount', () => {
    expect(rows[6]).toMatchObject({ amount: 25, type: 'expense', category: 'Personal expenses' })
    expect(rows[7]).toMatchObject({ amount: 50, type: 'income', category: 'Other Income' })
    // both lines' "Available Balance" figures (16,374.30 / 16,424.30) must never appear as `amount`
    expect(rows.some((r) => r.amount === 16374.3 || r.amount === 16424.3)).toBe(false)
  })

  it('normalises the MAJID AL FUTTAIM HM alias to Carrefour', () => {
    expect(rows[8]).toMatchObject({ merchant: 'Carrefour', amount: 320 })
  })

  it('applies a date-only header line to the following lines that have no in-sentence date', () => {
    expect(rows[9]).toMatchObject({ date: '2026-08-19', merchant: 'Careem Food', amount: 45 })
    expect(rows[10]).toMatchObject({ date: '2026-08-19', merchant: 'Careem Food', amount: 12 })
  })
})
