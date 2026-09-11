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

// Groups of 2+ already-stored transactions that look like duplicates of each other — same
// bankRef, or same date|amount|rawMerchant. Used by the Dashboard's "Needs attention" count and
// (eventually) the full Duplicates screen.
export function findDuplicateGroups(transactions) {
  const groups = new Map()

  transactions.forEach((txn) => {
    const key = txn.bankRef ? `ref:${txn.bankRef}` : `dar:${txn.date}|${txn.amount}|${txn.rawMerchant}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(txn)
  })

  return Array.from(groups.values()).filter((group) => group.length > 1)
}
