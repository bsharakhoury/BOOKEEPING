import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { detect } from '../../src/lib/parsers/index.js'
import { categoriseRakTxtEntry, parseRakTxt, readRakTxtRows } from '../../src/lib/parsers/rakTxt.js'

const text = readFileSync(join(process.cwd(), 'tests/fixtures/rak_account_statement.txt'), 'utf8')
const rows = parseRakTxt(text, { ownerPattern: /TEST OWNER NAME/i })
const byAmountAndDate = (date, amount) => rows.find((r) => r.date === date && r.amount === amount)

describe('RAK TXT detection and layout', () => {
  it('is picked by its own header block, whatever the file is called', () => {
    expect(detect({ text, fileName: 'Account_Transactions_TXT31-07-2026.txt' }).id).toBe('rakTxt')
    expect(detect({ text, fileName: 'anything.txt' }).id).toBe('rakTxt')
    expect(detect({ text }).id).toBe('rakTxt')
  })

  it('reads every dated row, joining wrapped description lines and ignoring the "Value Date" line', () => {
    const raw = readRakTxtRows(text)
    expect(raw).toHaveLength(14)
    expect(raw.find((r) => r.withdrawal === 200).description).toBe('PURCHASE TRXN. Sample Shop Dubai ARE 546750XXXXXX0000')
  })

  it('puts amounts in the right column (withdrawal vs deposit) and reads the running balance', () => {
    const raw = readRakTxtRows(text)
    const inward = raw.find((r) => r.deposit === 10000)
    expect(inward).toMatchObject({ withdrawal: null, deposit: 10000, balance: 16451.45 })
    const atm = raw.find((r) => r.withdrawal === 5000)
    expect(atm).toMatchObject({ withdrawal: 5000, deposit: null, balance: 12000 })
  })

  it('every row balances against the next-older one (the file is internally consistent)', () => {
    const raw = readRakTxtRows(text)
    for (let i = 0; i < raw.length - 1; i++) {
      const expected = Math.round((raw[i + 1].balance - (raw[i].withdrawal || 0) + (raw[i].deposit || 0)) * 100) / 100
      expect(raw[i].balance).toBe(expected)
    }
  })
})

describe('RAK TXT classification', () => {
  it('treats the monthly maintenance and RAKvalue charges as bank fees with reclaimable input VAT once registered', () => {
    expect(byAmountAndDate('2026-06-01', 103.95)).toMatchObject({
      ruleId: 'RAKTXT_BANK_FEE', type: 'expense', category: 'LH – Bank Fees', ledger: 'lh_business',
      inputVat: 4.95, reclaimable: true, docType: 'Tax Invoice', paymentMethod: 'RAK Bank'
    })
    expect(byAmountAndDate('2026-06-25', 51.45)).toMatchObject({ inputVat: 2.45, docType: 'Tax Invoice' })
  })

  it('claims no VAT on a bank charge from before the VAT-registration date', () => {
    expect(byAmountAndDate('2026-02-02', 103.95)).toMatchObject({ ruleId: 'RAKTXT_BANK_FEE', inputVat: null, reclaimable: false, docType: null })
  })

  it('treats the two small remittance charges that follow an outward transfer as fees with VAT', () => {
    expect(byAmountAndDate('2026-06-18', 1.05)).toMatchObject({ category: 'LH – Bank Fees', inputVat: 0.05 })
    expect(byAmountAndDate('2026-06-18', 3.15)).toMatchObject({ category: 'LH – Bank Fees', inputVat: 0.15 })
  })

  it('records the FTA payment as LH – VAT, with no VAT of its own', () => {
    expect(byAmountAndDate('2026-06-25', 900)).toMatchObject({ ruleId: 'RAKTXT_FTA_PAYMENT', category: 'LH – VAT', type: 'expense', inputVat: null })
  })

  it('treats money moved to the owner as an outgoing transfer, not a business expense', () => {
    expect(byAmountAndDate('2026-06-18', 2000)).toMatchObject({ ruleId: 'RAKTXT_OWNER_TRANSFER', type: 'transfer', direction: 'out' })
  })

  it('treats an ATM cash withdrawal from the company account as an outgoing transfer', () => {
    expect(byAmountAndDate('2026-06-30', 5000)).toMatchObject({ ruleId: 'RAKTXT_ATM', type: 'transfer', direction: 'out' })
  })

  it('treats the payment processor payout as an incoming transfer so revenue is not counted twice', () => {
    expect(byAmountAndDate('2026-06-26', 1500)).toMatchObject({ ruleId: 'RAKTXT_STRIPE_PAYOUT', type: 'transfer', direction: 'in' })
  })

  it('records a client payment as income on the income ledger, keeping the payer name for rules to match', () => {
    const row = byAmountAndDate('2026-06-20', 10000)
    expect(row).toMatchObject({ type: 'income', ledger: 'income', paymentMethod: 'RAK Bank' })
    expect(row.rawMerchant).toContain('EXAMPLE EVENTS AND PRODUCTIONS')
    expect(row.rawMerchant).not.toContain('/REF/')
  })

  it('records an Aani payment out as a supplier payment and an Aani payment in as income', () => {
    expect(byAmountAndDate('2026-06-10', 300)).toMatchObject({ ruleId: 'RAKTXT_AANI_OUT', type: 'expense', category: 'LH – Supplier Payment' })
    expect(byAmountAndDate('2026-06-10', 300).rawMerchant).toBe('Aani transfer to SAMPLE SUPPLIER SERVICES')
    expect(byAmountAndDate('2026-06-05', 700)).toMatchObject({ ruleId: 'RAKTXT_AANI_IN', type: 'income' })
  })

  it('records a card purchase and its reversal, the reversal as a refund', () => {
    expect(byAmountAndDate('2026-06-08', 200)).toMatchObject({ ruleId: 'RAKTXT_CARD_PURCHASE', type: 'expense', rawMerchant: 'Sample Shop Dubai ARE' })
    expect(byAmountAndDate('2026-06-08', 50)).toMatchObject({ ruleId: 'RAKTXT_CARD_REFUND', type: 'refund' })
  })

  it('carries the balance after each row and never invents a bank reference', () => {
    expect(byAmountAndDate('2026-06-30', 5000)).toMatchObject({ balanceAfter: 12000, bankRef: null, currency: 'AED', fxRate: 1 })
  })

  it('gives every row in the fixture a recognised rule (none fall through to the generic bucket)', () => {
    expect(rows.filter((r) => r.ruleId === 'RAKTXT_UNRECOGNISED')).toEqual([])
  })

  it('falls back to a generic bucket for an entry type it has not seen, by column', () => {
    expect(categoriseRakTxtEntry('SOMETHING NEW', { isCredit: true, amount: 10, date: '2026-06-01' })).toMatchObject({ ruleId: 'RAKTXT_UNRECOGNISED', type: 'income' })
    expect(categoriseRakTxtEntry('SOMETHING NEW', { isCredit: false, amount: 10, date: '2026-06-01' })).toMatchObject({ ruleId: 'RAKTXT_UNRECOGNISED', type: 'expense' })
  })

  it('classifies a transfer within RAKBANK to a named payee as a supplier payment', () => {
    const r = categoriseRakTxtEntry('FUNDS TRANSFER WITHIN RAKBANK PAYMENT FOR SUPPLIER To 0352150440001 SAMPLE PARTY', { isCredit: false, amount: 100, date: '2026-06-01' })
    expect(r).toMatchObject({ ruleId: 'RAKTXT_INTERNAL_TRANSFER', category: 'LH – Supplier Payment' })
    expect(r.rawMerchant).toBe('Transfer to SAMPLE PARTY')
  })
})
