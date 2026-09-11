// Built-in raw-merchant → clean-name (+ optional default category) aliases. These apply before
// any user-defined merchantRule is even consulted by categorise.js — they're bank-string quirks,
// not personal preferences.
export const MERCHANT_ALIASES = [{ match: /MAJID AL FUTTAIM HM/i, merchant: 'Carrefour', category: 'Food (Groceries)' }]

function titleCase(text) {
  return text.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase())
}

// Cleans a raw SMS/CSV merchant string into a display-friendly name: applies known aliases,
// otherwise drops a parenthetical foreign-amount note and any trailing ", City"/phone segment,
// then title-cases what's left.
export function normaliseMerchant(rawMerchant) {
  const raw = String(rawMerchant || '').trim()
  if (!raw) return ''

  const alias = MERCHANT_ALIASES.find((entry) => entry.match.test(raw))
  if (alias) return alias.merchant

  const cleaned = raw
    .replace(/\([^)]*\)/g, '')
    .split(',')[0]
    .trim()

  return titleCase(cleaned || raw)
}
