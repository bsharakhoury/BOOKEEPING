// Looks at transactions already sitting in the app and proposes merchantRules for merchants
// that have consistently gone to the same category — the same signal a person uses when they
// notice "every ENOC transaction I've ever categorised was Transport (Fuel)". Categorise.js's
// existing rule matching is a case-insensitive substring check, so the `match` text only needs
// to be a short brand keyword that shows up inside any future SMS or statement description —
// it doesn't need to be the exact merchant string.
import { ruleMatches } from './parsers/categorise.js'

const MIN_OCCURRENCES = 2
const MIN_CONFIDENCE = 0.85
// The parsers' own default for an unclassified purchase — a rule that just restates it adds nothing.
const DEFAULT_CATEGORY = 'Personal expenses'

// Strips the SMS-style "Purchase with Debit/Credit Card ending NNNN at " prefix (older imports
// stored the merchant field with this still attached) and any trailing phone number / "(USD ..."
// annotation, leaving just the merchant's own text.
const CARD_PREFIX_RE = /^Purchase with (?:Debit|Credit) Card ending \d{4} at\s+/i

// Bank-statement merchant text trails currency codes, cities and legal suffixes after the brand
// ("SMARTDXBGOV-PRKN AED DUBAI AE", "ENOC RETAIL LLC AED DUBAI AE") — none of that identifies the
// merchant, so it's skipped when picking the keyword.
const NOISE_WORDS = new Set([
  'AED', 'USD', 'EUR', 'GBP', 'DUBAI', 'ABU', 'DHABI', 'SHARJAH', 'FUJAIRAH', 'AJMAN', 'UAE', 'DUB',
  'LLC', 'FZE', 'FZCO', 'FZ', 'LTD', 'INC', 'PURCHASE', 'PAYMENT', 'WITH', 'CARD', 'ENDING'
])

function coreMerchantText(rawMerchant) {
  const withoutPrefix = String(rawMerchant || '').replace(CARD_PREFIX_RE, '')
  return withoutPrefix
    .replace(/\+?\d{7,}.*$/, '')
    .replace(/\(USD.*$/i, '')
    .trim()
}

// A short, stable grouping key: the first one or two significant words (letters, length >= 3),
// skipping pure numbers and noise — e.g. "ENOC SITE 7825, DUBAI" -> "ENOC SITE", "CAREEM FOOD,
// Dubai" -> "CAREEM FOOD". Different branches/site numbers of the same brand collapse to the
// same key.
export function extractKey(rawMerchant) {
  const cleaned = coreMerchantText(rawMerchant)
  const words = cleaned
    .split(/[\s,]+/)
    // "WORKSP#237014589" -> "WORKSP": a trailing invoice/reference suffix isn't part of the brand.
    .map((word) => word.replace(/#.*$/, ''))
    // Words carrying 2+ digits are reference codes ("P3E86D7BF3", "E4011907"), not brand names.
    .filter((word) => word.length >= 3 && (word.match(/\d/g) || []).length < 2 && !NOISE_WORDS.has(word.toUpperCase()))
  return words.slice(0, 2).join(' ').toUpperCase()
}

function mostCommon(counts) {
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]
}

export function suggestMerchantRules(transactions, existingRules = []) {
  const groups = new Map()

  transactions.forEach((txn) => {
    // Only purchases: income/transfer/refund rows get their category from parser rules of their
    // own (salary, ATM, account transfer…), and a merchant rule would override that.
    if (txn.type && txn.type !== 'expense') return
    const key = extractKey(txn.rawMerchant || txn.merchant)
    if (!key) return
    if (!groups.has(key)) groups.set(key, { categories: new Map(), ledgersByCategory: new Map() })
    const group = groups.get(key)
    group.categories.set(txn.category, (group.categories.get(txn.category) || 0) + 1)
    if (!group.ledgersByCategory.has(txn.category)) group.ledgersByCategory.set(txn.category, new Map())
    const ledgers = group.ledgersByCategory.get(txn.category)
    ledgers.set(txn.ledger, (ledgers.get(txn.ledger) || 0) + 1)
  })

  const suggestions = []
  for (const [key, group] of groups) {
    const total = Array.from(group.categories.values()).reduce((sum, count) => sum + count, 0)
    if (total < MIN_OCCURRENCES) continue

    const [topCategory, topCount] = mostCommon(group.categories)
    const confidence = topCount / total
    if (confidence < MIN_CONFIDENCE) continue
    if (topCategory === DEFAULT_CATEGORY) continue

    const fakeRow = { rawMerchant: key }
    if (existingRules.some((rule) => ruleMatches(rule, fakeRow))) continue

    const [ledger] = mostCommon(group.ledgersByCategory.get(topCategory))
    suggestions.push({ match: key, category: topCategory, ledger, occurrences: total, confidence })
  }

  return suggestions.sort((a, b) => b.occurrences - a.occurrences)
}

// Merges rules from a file into the current list by `match` text (case-insensitive), so loading
// the same file twice — or a file that overlaps rules you already have — never duplicates
// anything. Existing rules win; entries without a match text or category are ignored.
export function mergeMerchantRules(existing, incoming, makeId) {
  const seen = new Set(existing.map((rule) => String(rule.match).toLowerCase()))
  const added = []
  for (const rule of incoming) {
    if (!rule || !rule.match || !rule.category) continue
    const key = String(rule.match).toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    added.push({ id: makeId(), match: rule.match, merchant: rule.merchant || null, category: rule.category, ledger: rule.ledger || 'personal' })
  }
  return { merged: [...existing, ...added], addedCount: added.length }
}
