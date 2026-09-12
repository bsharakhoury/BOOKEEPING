import { lastNMonthKeys, monthKey, monthKeysInRange, monthLabel, monthRange, todayISO } from '../dates.js'
import { invoiceSubtotal } from './invoices.js'

function round2(value) {
  return Math.round(value * 100) / 100
}

// 12-month (or however many requested) cash-flow series: income, expense (refunds netted
// against it, transfers excluded — same rule as totalsForRange), and net per month.
export function cashFlowSeries(transactions, { months = 12, today = todayISO() } = {}) {
  const keys = lastNMonthKeys(today, months)
  return keys.map((key) => {
    const rows = transactions.filter((txn) => monthKey(txn.date) === key)
    const income = round2(rows.reduce((sum, txn) => (txn.type === 'income' ? sum + Number(txn.amount || 0) : sum), 0))
    const expense = round2(
      rows.reduce((sum, txn) => {
        if (txn.type === 'expense') return sum + Number(txn.amount || 0)
        if (txn.type === 'refund') return sum - Number(txn.amount || 0)
        return sum
      }, 0)
    )
    return { month: key, label: monthLabel(key), income, expense, net: round2(income - expense) }
  })
}

// Monthly spend for one category over the trailing `months`.
export function categoryTrend(transactions, categoryName, { months = 12, today = todayISO() } = {}) {
  const keys = lastNMonthKeys(today, months)
  return keys.map((key) => {
    const amount = round2(
      transactions
        .filter((txn) => monthKey(txn.date) === key && txn.category === categoryName)
        .reduce((sum, txn) => sum + (txn.type === 'refund' ? -Number(txn.amount || 0) : txn.type === 'expense' ? Number(txn.amount || 0) : 0), 0)
    )
    return { month: key, label: monthLabel(key), amount }
  })
}

// Month-over-month variance per category (this month vs last), sorted by biggest absolute
// change first. Categories with zero spend in both months are omitted.
export function monthOverMonthVariance(transactions, { today = todayISO() } = {}) {
  const [previousKey, currentKey] = lastNMonthKeys(today, 2)
  const totals = new Map()

  transactions.forEach((txn) => {
    if (txn.type !== 'expense' && txn.type !== 'refund') return
    const key = monthKey(txn.date)
    if (key !== previousKey && key !== currentKey) return
    const signedAmount = txn.type === 'refund' ? -Number(txn.amount || 0) : Number(txn.amount || 0)
    const entry = totals.get(txn.category) || { category: txn.category, previous: 0, current: 0 }
    if (key === previousKey) entry.previous = round2(entry.previous + signedAmount)
    else entry.current = round2(entry.current + signedAmount)
    totals.set(txn.category, entry)
  })

  return Array.from(totals.values())
    .map((entry) => ({
      ...entry,
      delta: round2(entry.current - entry.previous),
      deltaPct: entry.previous !== 0 ? round2(((entry.current - entry.previous) / entry.previous) * 100) : null
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

const STREAM_LABELS = { salary: 'Salary', lh_media: 'Leaf & Hook – Media', lh_wellness: 'Leaf & Hook – Wellness', freelance: 'Freelance', other: 'Other' }

export function incomeByStream(transactions, categories, range) {
  const streamByCategory = new Map(categories.filter((c) => c.type === 'income').map((c) => [c.name, c.stream || 'other']))
  const totals = new Map()

  transactions
    .filter((txn) => txn.type === 'income' && txn.date >= range.start && txn.date <= range.end)
    .forEach((txn) => {
      const stream = streamByCategory.get(txn.category) || 'other'
      totals.set(stream, round2((totals.get(stream) || 0) + Number(txn.amount || 0)))
    })

  return Array.from(totals.entries())
    .map(([stream, amount]) => ({ stream, label: STREAM_LABELS[stream] || stream, amount }))
    .sort((a, b) => b.amount - a.amount)
}

function clientFromTags(tags) {
  const tag = (tags || []).find((t) => t.toLowerCase().startsWith('client:'))
  return tag ? tag.slice('client:'.length).trim() : null
}

export function incomeByClient(transactions, range) {
  const totals = new Map()
  transactions
    .filter((txn) => txn.type === 'income' && txn.date >= range.start && txn.date <= range.end)
    .forEach((txn) => {
      const client = clientFromTags(txn.tags) || 'Unassigned'
      totals.set(client, round2((totals.get(client) || 0) + Number(txn.amount || 0)))
    })
  return Array.from(totals.entries())
    .map(([client, amount]) => ({ client, amount }))
    .sort((a, b) => b.amount - a.amount)
}

const PRODUCTION_COST_CATEGORIES = new Set(['LH – Production Costs', 'LH – Supplier Payment', 'LH – Equipment'])
const EXCLUDED_FROM_PL = new Set(['LH – VAT'])

// Leaf & Hook P&L for a range: revenue (ex-VAT — invoiced lines are already split from VAT;
// non-invoiced lh_business income transactions have no separate VAT component in this model, so
// their amount is taken as-is), production costs, opex (everything else, VAT payments excluded
// since those aren't a P&L expense), and net.
const LH_STREAMS = new Set(['lh_media', 'lh_wellness'])

export function lhProfitAndLoss(transactions, invoices, categories, range) {
  const invoiceRevenue = invoices
    .filter((invoice) => invoice.issueDate >= range.start && invoice.issueDate <= range.end)
    .reduce((sum, invoice) => sum + invoiceSubtotal(invoice), 0)

  // Income always carries ledger 'income' app-wide (never 'lh_business' — that ledger is only
  // used for L&H's own expense activity), so L&H revenue is identified by category stream, the
  // same way the Income screen buckets it — not by ledger.
  const streamByCategory = new Map(categories.filter((c) => c.type === 'income').map((c) => [c.name, c.stream]))
  const nonInvoiceRevenue = transactions
    .filter(
      (txn) =>
        txn.type === 'income' && txn.date >= range.start && txn.date <= range.end && LH_STREAMS.has(streamByCategory.get(txn.category))
    )
    .reduce((sum, txn) => sum + Number(txn.amount || 0), 0)

  const lhRows = transactions.filter((txn) => txn.ledger === 'lh_business' && txn.date >= range.start && txn.date <= range.end)
  const expenseRows = lhRows.filter((txn) => (txn.type === 'expense' || txn.type === 'refund') && !EXCLUDED_FROM_PL.has(txn.category))
  const signedAmount = (txn) => (txn.type === 'refund' ? -Number(txn.amount || 0) : Number(txn.amount || 0))

  const productionCosts = expenseRows
    .filter((txn) => PRODUCTION_COST_CATEGORIES.has(txn.category))
    .reduce((sum, txn) => sum + signedAmount(txn), 0)

  const opex = expenseRows
    .filter((txn) => !PRODUCTION_COST_CATEGORIES.has(txn.category))
    .reduce((sum, txn) => sum + signedAmount(txn), 0)

  const revenue = round2(invoiceRevenue + nonInvoiceRevenue)
  return {
    revenue,
    productionCosts: round2(productionCosts),
    opex: round2(opex),
    net: round2(revenue - productionCosts - opex)
  }
}

// Custom-range report: pick a month range, a set of ledgers, and a set of category names, and
// get totals + per-month averages for each selected category, plus a month-by-month breakdown.
// Mirrors the previous app's Reports screen (date range + ledger + category pickers).
export function customRangeReport(transactions, categories, { startMonth, endMonth, ledgers, categoryNames }) {
  const months = monthKeysInRange(startMonth, endMonth)
  const monthCount = months.length || 1
  const { start } = monthRange(months[0])
  const { end } = monthRange(months[months.length - 1])

  const ledgerSet = new Set(ledgers)
  const categorySet = categoryNames ? new Set(categoryNames) : null
  const categoryByName = new Map(categories.map((c) => [c.name, c]))

  const inRange = transactions.filter((txn) => {
    if (txn.date < start || txn.date > end) return false
    if (txn.type === 'transfer') return false
    if (!ledgerSet.has(txn.ledger)) return false
    if (categorySet && !categorySet.has(txn.category)) return false
    return true
  })

  function bucketBy(rows, type) {
    const totals = new Map()
    rows
      .filter((txn) => (type === 'income' ? txn.type === 'income' : txn.type === 'expense' || txn.type === 'refund'))
      .forEach((txn) => {
        const signedAmount = txn.type === 'refund' ? -Number(txn.amount || 0) : Number(txn.amount || 0)
        totals.set(txn.category, round2((totals.get(txn.category) || 0) + signedAmount))
      })
    return Array.from(totals.entries())
      .map(([name, amount]) => ({
        name,
        color: categoryByName.get(name)?.color || null,
        amount,
        avgPerMonth: round2(amount / monthCount)
      }))
      .sort((a, b) => b.amount - a.amount)
  }

  const incomeByCategory = bucketBy(inRange, 'income')
  const expensesByCategory = bucketBy(inRange, 'expense')

  const netIncome = round2(incomeByCategory.reduce((sum, row) => sum + row.amount, 0))
  const totalExpenses = round2(expensesByCategory.reduce((sum, row) => sum + row.amount, 0))
  const netPosition = round2(netIncome - totalExpenses)
  const avgMonthlyNet = round2(netPosition / monthCount)

  const monthly = months.map((key) => {
    const rows = inRange.filter((txn) => monthKey(txn.date) === key)
    const income = round2(rows.filter((txn) => txn.type === 'income').reduce((sum, txn) => sum + Number(txn.amount || 0), 0))
    const expense = round2(
      rows
        .filter((txn) => txn.type === 'expense' || txn.type === 'refund')
        .reduce((sum, txn) => sum + (txn.type === 'refund' ? -Number(txn.amount || 0) : Number(txn.amount || 0)), 0)
    )
    const net = round2(income - expense)
    const vsAvg = round2(net - avgMonthlyNet)
    return { month: key, label: monthLabel(key), income, expense, net, vsAvg }
  })

  return {
    months,
    monthCount,
    incomeByCategory,
    expensesByCategory,
    summary: { netIncome, totalExpenses, netPosition, avgMonthlyNet },
    monthly
  }
}

// Months of runway = current cash position / average monthly net burn over the trailing
// `months`. Returns null (shown as "N/A" — cash isn't shrinking) when the average is break-even
// or better.
export function runwayMonths(cashPosition, transactions, { months = 3, today = todayISO() } = {}) {
  const series = cashFlowSeries(transactions, { months, today })
  const averageNet = series.reduce((sum, entry) => sum + entry.net, 0) / series.length
  if (averageNet >= 0) return null
  return round2(cashPosition / Math.abs(averageNet))
}
