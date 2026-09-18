// Matches freshly-parsed Mashreq statement rows against transactions already in the app for the
// same account and month, so re-importing a statement (a month already covered by SMS-derived
// entries, say) corrects what's there instead of duplicating it. Matching is by month + merchant
// word overlap rather than exact date/amount, because the two things a statement re-import is
// usually fixing ARE the existing entry's date and amount — an exact-match check would just fail
// to find them. Any existing entry no statement row claims is flagged: often a card-authorization
// hold that an SMS alert reported but that never actually posted, so the real statement has no
// row for it at all.
const STATEMENT_ACCOUNTS = new Set(['Mashreq Debit 9437', 'Mashreq Transfer', 'Mashreq'])

function normaliseForMatch(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function tokenSet(text) {
  return new Set(normaliseForMatch(text).split(' ').filter((token) => token.length >= 3))
}

// Substring containment (not just exact equality) catches cases like the statement's
// "DNHGODADDY" fusing a payment-processor prefix onto the merchant name with no separator,
// where a plain word-for-word match would miss "GODADDY" entirely.
function tokensOverlap(a, b) {
  for (const tokenA of a) {
    for (const tokenB of b) {
      if (tokenA === tokenB || tokenA.includes(tokenB) || tokenB.includes(tokenA)) return true
    }
  }
  return false
}

export function reconcileStatementRows(statementRows, existingTransactions) {
  const months = new Set(statementRows.map((row) => row.date.slice(0, 7)))
  const candidates = existingTransactions.filter(
    (txn) => STATEMENT_ACCOUNTS.has(txn.paymentMethod) && months.has(String(txn.date).slice(0, 7))
  )
  const consumed = new Set()
  const updates = []
  const additions = []

  for (const row of statementRows) {
    const rowTokens = tokenSet(row.rawMerchant)
    const month = row.date.slice(0, 7)

    let best = null
    let bestDiff = Infinity
    for (const existing of candidates) {
      if (consumed.has(existing.id)) continue
      if (String(existing.date).slice(0, 7) !== month) continue
      const existingTokens = tokenSet(existing.rawMerchant || existing.merchant)
      if (!tokensOverlap(rowTokens, existingTokens)) continue
      const diff = Math.abs(Number(existing.amount) - row.amount)
      if (diff < bestDiff) {
        best = existing
        bestDiff = diff
      }
    }

    if (!best) {
      additions.push(row)
      continue
    }

    consumed.add(best.id)
    const dateChanged = best.date !== row.date
    const amountChanged = Math.round(Number(best.amount) * 100) !== Math.round(row.amount * 100)
    if (dateChanged || amountChanged) {
      updates.push({
        id: best.id,
        before: { date: best.date, amount: Number(best.amount), merchant: best.merchant },
        after: { date: row.date, amount: row.amount, rawMerchant: row.rawMerchant, bankRef: row.bankRef, notes: row.notes }
      })
    }
  }

  const flagged = candidates.filter((existing) => !consumed.has(existing.id))

  return { updates, additions, flagged }
}
