import { describe, expect, it } from 'vitest'
import { categorise } from '../../src/lib/parsers/categorise.js'

const baseRow = {
  rawMerchant: 'CAREEM QUIK, Abu Dhabi',
  merchant: 'Careem Quik',
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
    const rules = [{ match: 'careem quik', merchant: 'Careem', category: 'Transport (Public/Taxi)', ledger: 'personal' }]
    expect(categorise(baseRow, { merchantRules: rules })).toMatchObject({
      merchant: 'Careem',
      category: 'Transport (Public/Taxi)'
    })
  })

  it('supports a "/pattern/flags" regex merchant rule', () => {
    const rules = [{ match: '/careem.*quik/i', merchant: 'Careem Quik', category: 'Food (Eating Out)', ledger: 'personal' }]
    expect(categorise(baseRow, { merchantRules: rules })).toMatchObject({ category: 'Food (Eating Out)' })
  })

  it('ignores a merchant rule that does not match', () => {
    const rules = [{ match: 'netflix', merchant: 'Netflix', category: 'Personal subscription', ledger: 'personal' }]
    expect(categorise(baseRow, { merchantRules: rules })).toEqual(baseRow)
  })
})
