// Looks at transactions already sitting in the app and proposes merchantRules for merchants
// that have consistently gone to the same category — the same signal a person uses when they
// notice "every ENOC transaction I've ever categorised was Transport (Fuel)". Categorise.js's
// existing rule matching is a case-insensitive substring check, so the `match` text only needs
// to be a short brand keyword that shows up inside any future SMS or statement description —
// it doesn't need to be the exact merchant string.
import { ruleMatches } from './parsers/categorise.js'

const MIN_OCCURRENCES = 2
const MIN_CONFIDENCE = 0.85

// Strips the SMS-style "Purchase with Debit/Credit Card ending NNNN at " prefix (older imports
// stored the merchant field with this still attached) and any trailing phone number / "(USD ..."
// annotation, leaving just the merchant's own text.
const CARD_PREFIX_RE = /^Purchase with (?:Debit|Credit) Card ending \d{4} at\s+/i

function coreMerchantText(rawMerchant) {
  const withoutPrefix = String(rawMerchant || '').replace(CARD_PREFIX_RE, '')
  return withoutPrefix
    .replace(/\+?\d{7,}.*$/, '')
    .replace(/\(USD.*$/i, '')
    .trim()
}

// A short, stable grouping key: the first one or two significant words (letters, length >= 3),
// skipping pure numbers — e.g. "ENOC SITE 7825, DUBAI" -> "ENOC SITE", "CAREEM FOOD, Dubai" ->
// "CAREEM FOOD". Different branches/site numbers of the same brand collapse to the same key.
function extractKey(rawMerchant) {
  const cleaned = coreMerchantText(rawMerchant)
  const words = cleaned.split(/[\s,]+/).filter((word) => word.length >= 3 && !/^\d+$/.test(word))
  return words.slice(0, 2).join(' ').toUpperCase()
}

export function suggestMerchantRules(transactions, existingRules = []) {
  const groups = new Map()

  transactions.forEach((txn) => {
    const key = extractKey(txn.rawMerchant || txn.merchant)
    if (!key) return
    if (!groups.has(key)) groups.set(key, { counts: new Map(), sample: txn })
    const group = groups.get(key)
    group.counts.set(txn.category, (group.counts.get(txn.category) || 0) + 1)
  })

  const suggestions = []
  for (const [key, group] of groups) {
    const total = Array.from(group.counts.values()).reduce((sum, count) => sum + count, 0)
    if (total < MIN_OCCURRENCES) continue

    const [topCategory, topCount] = Array.from(group.counts.entries()).sort((a, b) => b[1] - a[1])[0]
    const confidence = topCount / total
    if (confidence < MIN_CONFIDENCE) continue

    const fakeRow = { rawMerchant: key }
    if (existingRules.some((rule) => ruleMatches(rule, fakeRow))) continue

    suggestions.push({ match: key, category: topCategory, ledger: group.sample.ledger, occurrences: total, confidence })
  }

  return suggestions.sort((a, b) => b.occurrences - a.occurrences)
}
