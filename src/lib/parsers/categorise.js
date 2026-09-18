import { MERCHANT_ALIASES } from './merchants.js'

// merchantRules entries store `match` as either a plain substring (case-insensitive) or a
// "/pattern/flags" string (stored as text since JSON can't hold a RegExp).
export function ruleMatches(rule, row) {
  const target = row.rawMerchant || row.merchant || ''
  const source = String(rule.match || '')
  if (!source) return false

  if (source.startsWith('/')) {
    const lastSlash = source.lastIndexOf('/')
    if (lastSlash > 0) {
      try {
        return new RegExp(source.slice(1, lastSlash), source.slice(lastSlash + 1)).test(target)
      } catch {
        return false
      }
    }
  }

  return target.toLowerCase().includes(source.toLowerCase())
}

// Applies, in priority order: a matching user-defined merchant rule, then a built-in merchant
// alias's default category, then leaves the row's own parser-assigned defaults untouched.
export function categorise(row, { merchantRules = [] } = {}) {
  const userRule = merchantRules.find((rule) => ruleMatches(rule, row))
  if (userRule) {
    return {
      ...row,
      merchant: userRule.merchant || row.merchant,
      category: userRule.category || row.category,
      ledger: userRule.ledger || row.ledger
    }
  }

  const alias = MERCHANT_ALIASES.find((entry) => entry.match.test(row.rawMerchant || ''))
  if (alias && alias.category) {
    return { ...row, merchant: alias.merchant, category: alias.category }
  }

  return row
}
