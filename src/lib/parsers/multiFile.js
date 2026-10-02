// Combines the rows parsed from several statement files dropped together (e.g. a RAK history file
// plus June and July) into one import. All files must be the same kind — a Mashreq statement and a
// RAK statement are reconciled against different accounts, so they go through separately.
//
// Overlapping files (a monthly export that repeats days a longer export already covered) would
// otherwise import the same transactions twice. A row is only treated as a repeat when it matches
// on date, amount, type, text AND the bank's running balance (or its own reference) — two genuinely
// separate identical charges on one day have different balances, so they are both kept.
function repeatKey(row) {
  const anchor = row.balanceAfter != null ? `bal:${row.balanceAfter}` : row.bankRef ? `ref:${row.bankRef}` : null
  if (!anchor) return null
  return [row.date, row.amount, row.type, row.rawMerchant, anchor].join('|')
}

export function mergeParsedFiles(results) {
  if (results.length === 0) throw new Error('No files to import.')

  const kinds = new Set(results.map((result) => result.parserId))
  if (kinds.size > 1) {
    const names = Array.from(new Set(results.map((result) => result.label))).join(' and ')
    throw new Error(`These files are different kinds of statement (${names}). Import one kind at a time.`)
  }

  const seen = new Set()
  const rows = []
  let duplicatesDropped = 0
  for (const result of results) {
    for (const row of result.rows) {
      const key = repeatKey(row)
      if (key && seen.has(key)) {
        duplicatesDropped++
        continue
      }
      if (key) seen.add(key)
      rows.push(row)
    }
  }

  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))

  return {
    parserId: results[0].parserId,
    label: results[0].label,
    rows,
    duplicatesDropped,
    sourceName: results.length === 1 ? results[0].fileName : `${results.length} files`
  }
}
