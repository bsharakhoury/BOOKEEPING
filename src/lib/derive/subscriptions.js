import { addMonths, todayISO } from '../dates.js'

const FREQUENCY_MONTHS = { monthly: 1, quarterly: 3, biannual: 6, yearly: 12 }
const ANNUAL_MULTIPLIER = { monthly: 12, quarterly: 4, biannual: 2, yearly: 1 }

function round2(value) {
  return Math.round(value * 100) / 100
}

export function advanceDueDate(dueDate, frequency) {
  return addMonths(dueDate, FREQUENCY_MONTHS[frequency] || 1)
}

// Rolls each active subscription's nextDue forward (recording lastDue as the cycle just
// passed) until nextDue is today or later. Inactive subscriptions and ones without a nextDue
// are left untouched.
export function rollForwardDueDates(subscriptions, today = todayISO()) {
  return subscriptions.map((sub) => {
    if (!sub.active || !sub.nextDue) return sub

    let nextDue = sub.nextDue
    let lastDue = sub.lastDue
    let rolled = false

    while (nextDue < today) {
      lastDue = nextDue
      nextDue = advanceDueDate(nextDue, sub.frequency)
      rolled = true
    }

    return rolled ? { ...sub, nextDue, lastDue } : sub
  })
}

// Finds the transaction that looks like this subscription's payment for the current cycle:
// linked explicitly (linkedSubId) always wins; otherwise, among transactions matching category +
// ledger + type within one frequency period back from today, prefer the one whose amount is
// closest to the subscription's recorded amount. Category alone isn't a unique key — several
// subscriptions commonly share a generic category like "Personal subscription" — so falling
// back to "most recent" there would cross-match different subscriptions' payments to each other.
export function findPaymentForSubscription(sub, transactions, today = todayISO()) {
  const windowStart = addMonths(today, -(FREQUENCY_MONTHS[sub.frequency] || 1))

  const linked = transactions.find((txn) => txn.linkedSubId === sub.id)
  if (linked) return linked

  const candidates = transactions.filter(
    (txn) => txn.type === 'expense' && txn.category === sub.category && txn.ledger === sub.ledger && txn.date >= windowStart
  )
  if (candidates.length === 0) return null

  return [...candidates].sort((a, b) => {
    const diff = Math.abs(a.amount - sub.amount) - Math.abs(b.amount - sub.amount)
    if (diff !== 0) return diff
    return a.date < b.date ? 1 : -1
  })[0]
}

// True when the matched payment's actual amount differs from the subscription's recorded
// amount by more than 5% — a signal the provider changed its price.
export function priceChangeFlag(sub, matchedTxn) {
  if (!matchedTxn || !sub.amount) return false
  return Math.abs(matchedTxn.amount - sub.amount) / sub.amount > 0.05
}

export function annualCost(sub) {
  return round2((Number(sub.amount) || 0) * (ANNUAL_MULTIPLIER[sub.frequency] || 12))
}
