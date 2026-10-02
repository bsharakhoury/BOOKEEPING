import { describe, expect, it } from 'vitest'
import { categorise } from '../../src/lib/parsers/categorise.js'

const baseRow = {
  rawMerchant: 'SOME UNKNOWN SHOP, Abu Dhabi',
  merchant: 'Some Unknown Shop',
  category: 'Personal expenses',
  ledger: 'personal'
}

describe('categorise', () => {
  it('leaves a row untouched when nothing matches', () => {
    expect(categorise(baseRow, { merchantRules: [] })).toEqual(baseRow)
  })

  it('applies the built-in MAJID AL FUTTAIM HM → Carrefour / Food (Groceries) alias', () => {
    const row = { rawMerchant: 'MAJID AL FUTTAIM HM, Dubai', merchant: 'Majid Al Futtaim Hm', category: 'Personal expenses', ledger: 'personal' }
    expect(categorise(row, { merchantRules: [] })).toMatchObject({ merchant: 'Carrefour', category: 'Food (Groceries)' })
  })

  it('prefers a user-defined merchant rule (substring match) over the built-in alias', () => {
    const rules = [{ match: 'unknown shop', merchant: 'Careem', category: 'Transport (Public/Taxi)', ledger: 'personal' }]
    expect(categorise(baseRow, { merchantRules: rules })).toMatchObject({
      merchant: 'Careem',
      category: 'Transport (Public/Taxi)'
    })
  })

  it('supports a "/pattern/flags" regex merchant rule', () => {
    const rules = [{ match: '/unknown.*shop/i', merchant: 'Careem Quik', category: 'Food (Eating Out)', ledger: 'personal' }]
    expect(categorise(baseRow, { merchantRules: rules })).toMatchObject({ category: 'Food (Eating Out)' })
  })

  it('ignores a merchant rule that does not match', () => {
    const rules = [{ match: 'netflix', merchant: 'Netflix', category: 'Personal subscription', ledger: 'personal' }]
    expect(categorise(baseRow, { merchantRules: rules })).toEqual(baseRow)
  })

  it('applies built-in default rules with no user rules at all (ENOC -> Transport (Fuel))', () => {
    const row = { rawMerchant: 'Purchase with Debit Card ending 9437 at ENOC SITE 7825, DUBAI', merchant: 'Enoc Site 7825', category: 'Personal expenses', ledger: 'personal' }
    expect(categorise(row, { merchantRules: [] })).toMatchObject({ category: 'Transport (Fuel)', ledger: 'personal' })
  })

  it('also recognises the bank-statement spelling of a merchant', () => {
    const row = { rawMerchant: 'ROAD AND TRANSPORT AUT AED DUBAI AE', merchant: 'Road And Transport Aut', category: 'Personal expenses', ledger: 'personal' }
    expect(categorise(row, { merchantRules: [] })).toMatchObject({ category: 'Transport (Public/Taxi)' })
  })

  it('lets a user rule override a built-in default for the same merchant', () => {
    const row = { rawMerchant: 'ENOC SITE 7825, DUBAI', merchant: 'Enoc', category: 'Personal expenses', ledger: 'personal' }
    const rules = [{ match: 'ENOC', category: 'Business expenses', ledger: 'business' }]
    expect(categorise(row, { merchantRules: rules })).toMatchObject({ category: 'Business expenses', ledger: 'business' })
  })

  it('keeps Carrefour (Majid Al Futtaim) as Groceries — no default rule shadows the built-in alias', () => {
    const row = { rawMerchant: 'MAJID ALFUTTAIM HM IMP AED DUBAI', merchant: 'x', category: 'Personal expenses', ledger: 'personal' }
    expect(categorise({ ...row, rawMerchant: 'MAJID AL FUTTAIM HM' }, { merchantRules: [] })).toMatchObject({ category: 'Food (Groceries)' })
  })

  it('only ships default rules whose categories exist in the default category list', async () => {
    const { DEFAULT_CATEGORIES } = await import('../../src/data/categories.js')
    const { DEFAULT_MERCHANT_RULES } = await import('../../src/data/defaultMerchantRules.js')
    const names = new Set(DEFAULT_CATEGORIES.map((c) => c.name))
    expect(DEFAULT_MERCHANT_RULES.filter((r) => !names.has(r.category))).toEqual([])
  })
})
