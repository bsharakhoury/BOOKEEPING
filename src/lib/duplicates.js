// Duplicate matching for import: bankRef first, else date|amount|rawMerchant.
export function findDuplicateIndex(row, existingTransactions) {
  if (row.bankRef) {
    const byRef = existingTransactions.findIndex((txn) => txn.bankRef && txn.bankRef === row.bankRef)
    if (byRef !== -1) return byRef
  }

  return existingTransactions.findIndex(
    (txn) => txn.date === row.date && Number(txn.amount) === Number(row.amount) && txn.rawMerchant === row.rawMerchant
  )
}

export function isDuplicate(row, existingTransactions) {
  return findDuplicateIndex(row, existingTransactions) !== -1
}

// Exact-match groups of 2+ already-stored transactions that look like duplicates of each other —
// same bankRef, or same date|amount|rawMerchant. Each group carries a stable `key` so the
// Duplicates screen can persist "ignore this group" decisions.
export function findDuplicateGroups(transactions) {
  const groups = new Map()

  transactions.forEach((txn) => {
    const key = txn.bankRef ? `ref:${txn.bankRef}` : `dar:${txn.date}|${txn.amount}|${txn.rawMerchant}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(txn)
  })

  return Array.from(groups.entries())
    .filter(([, group]) => group.length > 1)
    .map(([key, group]) => ({ key, transactions: group }))
}

function normaliseMerchantForFuzzy(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function merchantsOverlap(a, b) {
  if (!a || !b) return false
  if (a === b) return true
  return a.includes(b) || b.includes(a)
}

function daysBetween(dateA, dateB) {
  return Math.abs(new Date(dateA) - new Date(dateB)) / 86400000
}

// Looser than findDuplicateGroups: same amount, dates within `dayWindow` of each other, and
// merchant names that overlap once normalised (rather than requiring an exact rawMerchant
// match). Transactions already covered by an exact-match group are excluded, so a pair isn't
// reported twice under both detectors.
export function findFuzzyDuplicateGroups(transactions, { dayWindow = 3 } = {}) {
  const exactIds = new Set(findDuplicateGroups(transactions).flatMap((group) => group.transactions.map((txn) => txn.id)))
  const candidates = transactions.filter((txn) => !exactIds.has(txn.id))

  const byAmount = new Map()
  candidates.forEach((txn) => {
    const amountKey = Number(txn.amount)
    if (!byAmount.has(amountKey)) byAmount.set(amountKey, [])
    byAmount.get(amountKey).push({ ...txn, _norm: normaliseMerchantForFuzzy(txn.rawMerchant || txn.merchant) })
  })

  const groups = []
  const grouped = new Set()

  byAmount.forEach((sameAmount) => {
    for (let i = 0; i < sameAmount.length; i++) {
      if (grouped.has(sameAmount[i].id)) continue
      const cluster = [sameAmount[i]]
      for (let j = i + 1; j < sameAmount.length; j++) {
        if (grouped.has(sameAmount[j].id)) continue
        if (daysBetween(sameAmount[i].date, sameAmount[j].date) <= dayWindow && merchantsOverlap(sameAmount[i]._norm, sameAmount[j]._norm)) {
          cluster.push(sameAmount[j])
        }
      }
      if (cluster.length > 1) {
        cluster.forEach((txn) => grouped.add(txn.id))
        const key = `fuzzy:${cluster.map((txn) => txn.id).sort().join(',')}`
        groups.push({ key, transactions: cluster.map(({ _norm, ...txn }) => txn) })
      }
    }
  })

  return groups
}
