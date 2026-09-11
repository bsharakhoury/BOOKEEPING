import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  mapLegacyBackup,
  mergeById,
  mergeVatAdjustments,
  parseLegacyBackup,
  unwrapRtfIfNeeded
} from '../src/lib/legacyImport.js'
import { DEFAULT_CATEGORIES } from '../src/data/categories.js'
import { DEFAULT_ACCOUNTS } from '../src/data/accounts.js'

const fixturePath = join(process.cwd(), 'tests/fixtures/legacyBackup.json')
const fixtureText = readFileSync(fixturePath, 'utf8')

const RTF_SNIPPET = `{\\rtf1\\ansi\\ansicpg1252\\cocoartf2761\n{\\fonttbl\\f0\\fswiss\\fcharset0 Helvetica;}\n{\\colortbl;\\red255\\green255\\blue255;}\n\\f0\\fs24 \\cf0 \\{"a":1,"b":"x\\'96y"\\}}`

describe('unwrapRtfIfNeeded', () => {
  it('passes plain JSON text through unchanged', () => {
    expect(unwrapRtfIfNeeded('{"a":1}')).toBe('{"a":1}')
  })

  it('unwraps a TextEdit-saved RTF backup back to plain JSON', () => {
    const result = unwrapRtfIfNeeded(RTF_SNIPPET)
    expect(result).toBe('{"a":1,"b":"x–y"}')
    expect(JSON.parse(result)).toEqual({ a: 1, b: 'x–y' })
  })

  it('unwraps the real old-my-financials.json fixture end to end', () => {
    const data = parseLegacyBackup(fixtureText)
    expect(Array.isArray(data.txns)).toBe(true)
  })
})

describe('parseLegacyBackup', () => {
  it('throws on unparseable content', () => {
    expect(() => parseLegacyBackup('not json')).toThrow(/could not read/i)
  })

  it("throws on JSON that isn't a legacy backup", () => {
    expect(() => parseLegacyBackup('{"foo":"bar"}')).toThrow(/legacy backup/i)
  })

  it('accepts a valid legacy backup', () => {
    const data = parseLegacyBackup(fixtureText)
    expect(data.txns).toHaveLength(6)
  })
})

describe('mapLegacyBackup', () => {
  const oldData = JSON.parse(fixtureText)
  const mapped = mapLegacyBackup(oldData, { categories: DEFAULT_CATEGORIES, accounts: DEFAULT_ACCOUNTS })

  it('maps counts for every populated collection', () => {
    expect(mapped.counts).toEqual({
      transactions: 6,
      subscriptions: 1,
      debts: 1,
      savingsEntries: 1,
      vatAdjustments: 2,
      newCategories: 1,
      newAccounts: 1
    })
  })

  it('normalizes a hyphen-variant category to the existing default category name', () => {
    const txn = mapped.transactions.find((t) => t.id === 'legacy-txn-t4')
    expect(txn.category).toBe('LH – Bank Fees')
    expect(txn.inputVat).toBe(2.45)
    expect(txn.reclaimable).toBe(true)
  })

  it('treats a "Transfer" category as a transfer-type transaction excluded from categorisation', () => {
    const txn = mapped.transactions.find((t) => t.id === 'legacy-txn-t3')
    expect(txn.type).toBe('transfer')
    expect(txn.category).toBe('Transfer')
  })

  it('creates a new custom category and account for unmapped values', () => {
    const txn = mapped.transactions.find((t) => t.id === 'legacy-txn-t5')
    expect(txn.category).toBe('Some New Category')
    expect(txn.paymentMethod).toBe('Unknown Wallet')
    expect(mapped.newCategories.map((c) => c.name)).toContain('Some New Category')
    expect(mapped.newAccounts.map((a) => a.name)).toContain('Unknown Wallet')
  })

  it('links a debt-payment transaction to its migrated debt by prefixed id', () => {
    const txn = mapped.transactions.find((t) => t.id === 'legacy-txn-t6')
    expect(txn.linkedDebtId).toBe('legacy-debt-d1')
    expect(mapped.debts[0].id).toBe('legacy-debt-d1')
    expect(mapped.debts[0].status).toBe('settled')
    expect(mapped.debts[0].payments[0]).toMatchObject({ amount: 1000, isSettlement: true, savedAmount: 4000 })
  })

  it('derives the VAT period from the record date and maps output/input into vatAdjustments', () => {
    const output = mapped.vatAdjustments.find((v) => v.kind === 'output')
    const input = mapped.vatAdjustments.find((v) => v.kind === 'input')
    expect(output.period).toBe('mar-may')
    expect(output.date).toBe('2026-03-28')
    expect(output.vat).toBe(12.14)
    expect(input.period).toBe('mar-may')
    expect(input.date).toBe('2026-03-02')
    expect(input.vat).toBe(4.95)
  })

  it('keeps distinct VAT records with the same recurring amount/description separate by date', () => {
    // regression: mergeVatAdjustments' dedupe key must include date, or repeated
    // subscription-style charges (same client/amount, different dates) collapse into one
    const recurringA = { period: 'mar-may', date: '2026-03-01', kind: 'output', amount: 100, vat: 5, description: 'Stripe' }
    const recurringB = { period: 'mar-may', date: '2026-04-01', kind: 'output', amount: 100, vat: 5, description: 'Stripe' }
    expect(mergeVatAdjustments([], [recurringA, recurringB])).toHaveLength(2)
  })

  it('warns about unmapped legacy collections that have data', () => {
    expect(mapped.warnings.some((w) => w.includes('invoices'))).toBe(true)
    expect(mapped.warnings.some((w) => w.includes('budgets'))).toBe(false)
  })
})

describe('mergeById / mergeVatAdjustments', () => {
  it('is idempotent when the same legacy import is applied twice', () => {
    const oldData = JSON.parse(fixtureText)
    const mapped = mapLegacyBackup(oldData, { categories: DEFAULT_CATEGORIES, accounts: DEFAULT_ACCOUNTS })

    const once = mergeById([], mapped.transactions)
    const twice = mergeById(once, mapped.transactions)
    expect(twice).toHaveLength(mapped.transactions.length)

    const vatOnce = mergeVatAdjustments([], mapped.vatAdjustments)
    const vatTwice = mergeVatAdjustments(vatOnce, mapped.vatAdjustments)
    expect(vatTwice).toHaveLength(mapped.vatAdjustments.length)
  })
})
