// Matches freshly-parsed bank-statement rows against transactions already in the app for the same
// account, so re-importing a statement corrects what's there instead of duplicating it, and
// flags anything the statement doesn't confirm.
//
// Two matching modes, because the two banks differ in what drifts:
//  - 'merchant' (Mashreq): amounts drift (foreign-currency charges are converted at the app's own
//    rate, so the SMS-era amount differs from what the card actually settled) and dates drift, so
//    rows are paired by month + merchant word overlap and the amount/date are what gets corrected.
//  - 'amount' (RAK): everything is exact AED, so rows are paired by identical amount + same
//    direction (money in vs out) within a few days; merchant wording is useless there ("LH –
//    Inward remittance Mar" vs "OUTWARD T/T … Bechara El Khoury") and only breaks ties.
//
// A flagged existing entry is often a card-authorization hold that an SMS reported but that never
// posted — or, on RAK, an entry recorded against the wrong account or in the wrong direction.
const MASHREQ_ACCOUNTS = new Set(['Mashreq Debit 9437', 'Mashreq Transfer', 'Mashreq'])

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

// Money in vs money out for an app transaction or a parsed statement row; null when unknown (a
// transfer recorded before transfers carried a direction).
function directionOf(item) {
  if (item.type === 'income' || item.type === 'refund') return 'in'
  if (item.type === 'expense') return 'out'
  if (item.type === 'transfer') return item.direction || null
  return null
}

function daysBetween(a, b) {
  return Math.abs(new Date(a) - new Date(b)) / 86400000
}

function shiftDate(dateStr, days) {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function toUpdate(existing, row) {
  return {
    id: existing.id,
    before: { date: existing.date, amount: Number(existing.amount), merchant: existing.merchant },
    after: { date: row.date, amount: row.amount, rawMerchant: row.rawMerchant, bankRef: row.bankRef, notes: row.notes }
  }
}

export function reconcileStatementRows(statementRows, existingTransactions, { accounts = MASHREQ_ACCOUNTS, matchBy = 'merchant', dayWindow = 10 } = {}) {
  const dates = statementRows.map((row) => row.date).sort()
  const periodStart = dates[0]
  const periodEnd = dates[dates.length - 1]
  const months = new Set(dates.map((date) => date.slice(0, 7)))

  const candidates = existingTransactions.filter((txn) => {
    if (!accounts.has(txn.paymentMethod)) return false
    const date = String(txn.date)
    // An entry whose recorded date is a few days off the bank's can sit just outside the period, so
    // matching looks a little beyond it (see `flagged` below for what is reported).
    return matchBy === 'amount' ? date >= shiftDate(periodStart, -dayWindow) && date <= shiftDate(periodEnd, dayWindow) : months.has(date.slice(0, 7))
  })

  const consumed = new Set()
  const updates = []
  const additions = []
  const matches = []

  for (const row of statementRows) {
    const rowTokens = tokenSet(row.rawMerchant)
    const rowDirection = directionOf(row)
    let best = null
    let bestScore = Infinity

    for (const existing of candidates) {
      if (consumed.has(existing.id)) continue
      const existingTokens = tokenSet(existing.rawMerchant || existing.merchant)
      let score

      if (matchBy === 'amount') {
        if (Math.round(Number(existing.amount) * 100) !== Math.round(row.amount * 100)) continue
        const existingDirection = directionOf(existing)
        if (rowDirection && existingDirection && rowDirection !== existingDirection) continue
        const gap = daysBetween(existing.date, row.date)
        if (gap > dayWindow) continue
        score = gap - (tokensOverlap(rowTokens, existingTokens) ? 0.5 : 0)
      } else {
        if (String(existing.date).slice(0, 7) !== row.date.slice(0, 7)) continue
        if (!tokensOverlap(rowTokens, existingTokens)) continue
        score = Math.abs(Number(existing.amount) - row.amount)
      }

      if (score < bestScore) {
        best = existing
        bestScore = score
      }
    }

    if (!best) {
      additions.push(row)
      continue
    }

    consumed.add(best.id)
    matches.push({ existing: best, row })
    const dateChanged = best.date !== row.date
    const amountChanged = Math.round(Number(best.amount) * 100) !== Math.round(row.amount * 100)
    if (dateChanged || amountChanged) updates.push(toUpdate(best, row))
  }

  // Only entries that fall inside the statement's own period can be called "missing from it".
  const flagged = candidates.filter((existing) => {
    if (consumed.has(existing.id)) return false
    return matchBy === 'amount' ? String(existing.date) >= periodStart && String(existing.date) <= periodEnd : true
  })

  return { updates, additions, flagged, matches }
}
