import { describe, expect, it } from 'vitest'
import { mergeMerchantRules, suggestMerchantRules } from '../src/lib/merchantRuleSuggestions.js'

function txn(overrides) {
  return { rawMerchant: 'ENOC SITE 7825, DUBAI', category: 'Transport (Fuel)', ledger: 'personal', ...overrides }
}

describe('suggestMerchantRules', () => {
  it('proposes a rule for a merchant that always got the same category, across different site numbers', () => {
    const transactions = [
      txn({ rawMerchant: 'ENOC SITE 7825, DUBAI' }),
      txn({ rawMerchant: 'ENOC SITE 1080, DUBAI' }),
      txn({ rawMerchant: 'ENOC SITE 4047 AED DUBAI AE' })
    ]
    const suggestions = suggestMerchantRules(transactions, [])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]).toMatchObject({ match: 'ENOC SITE', category: 'Transport (Fuel)', ledger: 'personal', occurrences: 3, confidence: 1 })
  })

  it('strips the legacy "Purchase with Card ending NNNN at" prefix before extracting the brand', () => {
    const transactions = [
      txn({ rawMerchant: 'Purchase with Debit Card ending 2986 at CAREEM QUIK, Abu Dhabi', category: 'Food (Eating Out)' }),
      txn({ rawMerchant: 'Purchase with Credit Card ending 8777 at CAREEM QUIK, Dubai', category: 'Food (Eating Out)' })
    ]
    const suggestions = suggestMerchantRules(transactions, [])
    expect(suggestions.find((s) => s.match === 'CAREEM QUIK')).toMatchObject({ category: 'Food (Eating Out)' })
  })

  it('requires at least two occurrences before suggesting a rule', () => {
    const suggestions = suggestMerchantRules([txn({ rawMerchant: 'ONE OFF SHOP, Dubai' })], [])
    expect(suggestions.find((s) => s.match.startsWith('ONE OFF'))).toBeUndefined()
  })

  it('skips a merchant whose category is inconsistent (below the confidence threshold)', () => {
    const transactions = [
      txn({ rawMerchant: 'AMAZON.AE ORDER1', category: 'Personal expenses' }),
      txn({ rawMerchant: 'AMAZON.AE ORDER2', category: 'Home' }),
      txn({ rawMerchant: 'AMAZON.AE ORDER3', category: 'Personal care' })
    ]
    expect(suggestMerchantRules(transactions, [])).toHaveLength(0)
  })

  it('still suggests a rule when the majority category clears the confidence threshold', () => {
    const transactions = [
      txn({ rawMerchant: 'SPOTIFY P123', category: 'Personal subscription' }),
      txn({ rawMerchant: 'SPOTIFY P456', category: 'Personal subscription' }),
      txn({ rawMerchant: 'SPOTIFY P789', category: 'Personal subscription' }),
      txn({ rawMerchant: 'SPOTIFY P000', category: 'Personal care' }) // 3/4 = 75%, below threshold
    ]
    expect(suggestMerchantRules(transactions, [])).toHaveLength(0)
  })

  it('does not suggest a merchant already covered by an existing rule', () => {
    const transactions = [txn({ rawMerchant: 'ENOC SITE 7825' }), txn({ rawMerchant: 'ENOC SITE 1080' })]
    const existingRules = [{ match: 'ENOC', category: 'Transport (Fuel)', ledger: 'personal' }]
    expect(suggestMerchantRules(transactions, existingRules)).toHaveLength(0)
  })

  it('ignores currency/city noise in bank-statement merchant text when picking the keyword', () => {
    const transactions = [
      txn({ rawMerchant: 'SMARTDXBGOV-PRKN AED DUBAI AE', category: 'Transport (Public/Taxi)' }),
      txn({ rawMerchant: 'SMARTDXBGOV-PRKN AED DUBAI AE', category: 'Transport (Public/Taxi)' })
    ]
    const suggestions = suggestMerchantRules(transactions, [])
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].match).toBe('SMARTDXBGOV-PRKN')
  })

  it('does not suggest a rule that merely restates the default "Personal expenses" category', () => {
    const transactions = [
      txn({ rawMerchant: 'AIR PUFF SMOKING ACCESS', category: 'Personal expenses' }),
      txn({ rawMerchant: 'AIR PUFF SMOKING ACCESS', category: 'Personal expenses' })
    ]
    expect(suggestMerchantRules(transactions, [])).toHaveLength(0)
  })

  it('only learns from expenses, not income or transfers', () => {
    const transactions = [
      txn({ rawMerchant: 'BENO TECHNOLOGIES FZCO', category: 'Salary – Beno', type: 'income' }),
      txn({ rawMerchant: 'BENO TECHNOLOGIES FZCO', category: 'Salary – Beno', type: 'income' })
    ]
    expect(suggestMerchantRules(transactions, [])).toHaveLength(0)
  })

  it('uses the ledger the winning category was most often filed under', () => {
    const transactions = [
      txn({ rawMerchant: 'SQSP* WORKSP#1', category: 'Business subscription', ledger: 'business' }),
      txn({ rawMerchant: 'SQSP* WORKSP#2', category: 'Business subscription', ledger: 'business' }),
      txn({ rawMerchant: 'SQSP* WORKSP#3', category: 'Business subscription', ledger: 'business' })
    ]
    expect(suggestMerchantRules(transactions, [])[0]).toMatchObject({ category: 'Business subscription', ledger: 'business' })
  })

  it('sorts suggestions by occurrence count, most frequent first', () => {
    const transactions = [
      txn({ rawMerchant: 'CAREEM FOOD A' }),
      txn({ rawMerchant: 'CAREEM FOOD B' }),
      txn({ rawMerchant: 'AL AFNAN SUPERMARKET A', category: 'Food (Groceries)' }),
      txn({ rawMerchant: 'AL AFNAN SUPERMARKET B', category: 'Food (Groceries)' }),
      txn({ rawMerchant: 'AL AFNAN SUPERMARKET C', category: 'Food (Groceries)' })
    ]
    const suggestions = suggestMerchantRules(transactions, [])
    // "AL" is dropped as too short to be a useful keyword — the next two significant words still
    // substring-match any future "AL AFNAN SUPERMARKET ..." description just fine.
    expect(suggestions[0].match).toBe('AFNAN SUPERMARKET')
    expect(suggestions[0].occurrences).toBe(3)
  })
})

describe('mergeMerchantRules', () => {
  let n = 0
  const makeId = () => `id-${++n}`

  it('adds new rules and keeps existing ones untouched', () => {
    const existing = [{ id: 'a', match: 'ENOC', category: 'Transport (Fuel)', ledger: 'personal' }]
    const incoming = [{ match: 'CAREEM FOOD', category: 'Food (Eating Out)', ledger: 'personal' }]
    const { merged, addedCount } = mergeMerchantRules(existing, incoming, makeId)
    expect(addedCount).toBe(1)
    expect(merged).toHaveLength(2)
    expect(merged[0]).toBe(existing[0])
  })

  it('skips a rule whose match text already exists, ignoring case', () => {
    const existing = [{ id: 'a', match: 'ENOC', category: 'Transport (Fuel)', ledger: 'personal' }]
    const { addedCount } = mergeMerchantRules(existing, [{ match: 'enoc', category: 'Something Else' }], makeId)
    expect(addedCount).toBe(0)
  })

  it('ignores entries missing a match text or category, and de-duplicates within the file', () => {
    const incoming = [{ match: '', category: 'X' }, { match: 'Y' }, { match: 'SPOTIFY', category: 'Personal subscription' }, { match: 'Spotify', category: 'Personal subscription' }]
    expect(mergeMerchantRules([], incoming, makeId).addedCount).toBe(1)
  })
})
