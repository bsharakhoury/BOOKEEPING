import { monthKey } from './dates.js'

export function parseSearchQuery(query) {
  const tokens = String(query || '').trim().split(/\s+/).filter(Boolean)
  const filters = { cat: null, acct: null, tag: null, minAmount: null, text: [] }

  tokens.forEach((token) => {
    const catMatch = /^cat:(.+)$/i.exec(token)
    const acctMatch = /^acct:(.+)$/i.exec(token)
    const tagMatch = /^tag:(.+)$/i.exec(token)
    const amountMatch = /^>(\d+(\.\d+)?)$/.exec(token)

    if (catMatch) filters.cat = catMatch[1].toLowerCase()
    else if (acctMatch) filters.acct = acctMatch[1].toLowerCase()
    else if (tagMatch) filters.tag = tagMatch[1].toLowerCase()
    else if (amountMatch) filters.minAmount = parseFloat(amountMatch[1])
    else filters.text.push(token.toLowerCase())
  })

  return filters
}

export function filterTransactions(transactions, { ledger = 'all', month = 'all', category = 'all', query = '' } = {}) {
  const parsed = parseSearchQuery(query)

  return transactions.filter((txn) => {
    if (ledger === 'transfers') {
      if (txn.type !== 'transfer') return false
    } else if (ledger !== 'all' && txn.ledger !== ledger) {
      return false
    }

    if (month !== 'all' && monthKey(txn.date) !== month) return false
    if (category !== 'all' && txn.category !== category) return false

    if (parsed.cat && !(txn.category || '').toLowerCase().includes(parsed.cat)) return false
    if (parsed.acct && !(txn.paymentMethod || '').toLowerCase().includes(parsed.acct)) return false
    if (parsed.tag && !(txn.tags || []).some((tag) => tag.toLowerCase().includes(parsed.tag))) return false
    if (parsed.minAmount !== null && !(txn.amount > parsed.minAmount)) return false

    if (parsed.text.length > 0) {
      const haystack = `${txn.merchant || ''} ${txn.notes || ''} ${txn.rawMerchant || ''}`.toLowerCase()
      if (!parsed.text.every((word) => haystack.includes(word))) return false
    }

    return true
  })
}
