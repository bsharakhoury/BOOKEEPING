import { addDays, monthRange, quarterRange, todayISO, ytdRange } from '../dates.js'
import { rentReserveMonthly } from './savings.js'

const BUSINESS_LEDGERS = new Set(['business', 'lh_business'])

function round2(value) {
  return Math.round(value * 100) / 100
}

export function rangeForView(monthKeyStr, view) {
  if (view === 'quarter') return quarterRange(monthKeyStr)
  if (view === 'ytd') return ytdRange(monthKeyStr)
  return monthRange(monthKeyStr)
}

function inRange(transactions, { start, end }) {
  return transactions.filter((txn) => txn.date >= start && txn.date <= end)
}

// Refunds reduce the category (and ledger) they refund, per the brief — so they're subtracted
// from expense totals here rather than counted as their own thing. Transfers are excluded from
// every income/expense total, also per the brief.
export function totalsForRange(transactions, range) {
  const rows = inRange(transactions, range)

  const income = rows.reduce((sum, txn) => (txn.type === 'income' ? sum + Number(txn.amount || 0) : sum), 0)

  const expenseFor = (ledgerTest) =>
    rows.reduce((sum, txn) => {
      if (!ledgerTest(txn.ledger)) return sum
      if (txn.type === 'expense') return sum + Number(txn.amount || 0)
      if (txn.type === 'refund') return sum - Number(txn.amount || 0)
      return sum
    }, 0)

  const personalExpense = expenseFor((ledger) => ledger === 'personal')
  const businessExpense = expenseFor((ledger) => BUSINESS_LEDGERS.has(ledger))

  return {
    income: round2(income),
    personalExpense: round2(personalExpense),
    businessExpense: round2(businessExpense),
    net: round2(income - personalExpense - businessExpense)
  }
}

// Running balance per account: opening balance plus every income/refund (credit) and expense
// (debit) transaction recorded against it. Transfers are excluded — the model only records one
// leg of a transfer, so treating it as a pure debit would understate total cash for a movement
// that's still sitting in *some* tracked account, just not one we can identify here.
export function accountBalances(accounts, transactions) {
  return accounts.map((account) => {
    const delta = transactions.reduce((sum, txn) => {
      if (txn.paymentMethod !== account.name) return sum
      if (txn.type === 'income' || txn.type === 'refund') return sum + Number(txn.amount || 0)
      if (txn.type === 'expense') return sum - Number(txn.amount || 0)
      return sum
    }, 0)
    return { account, balance: round2((Number(account.openingBalance) || 0) + delta) }
  })
}

export function totalCashPosition(accounts, transactions) {
  return round2(accountBalances(accounts, transactions).reduce((sum, entry) => sum + entry.balance, 0))
}

// Subscriptions due soon, active debts' monthly minimums, and the monthly rent reserve —
// combined into one "what's coming up" list. Debts and rent don't carry an exact due date in the
// data model, so they're shown as standing monthly obligations rather than dated line items.
export function upcomingObligations(subscriptions, debts, settings, { today = todayISO(), days = 14 } = {}) {
  const cutoff = addDays(today, days)
  const items = []

  subscriptions
    .filter((sub) => sub.active && sub.nextDue && sub.nextDue <= cutoff)
    .forEach((sub) => items.push({ type: 'subscription', label: sub.name, amount: Number(sub.amount) || 0, date: sub.nextDue }))

  debts
    .filter((debt) => debt.status !== 'settled' && Number(debt.monthlyMin) > 0)
    .forEach((debt) => items.push({ type: 'debt', label: `${debt.name} — minimum`, amount: Number(debt.monthlyMin) || 0, date: null }))

  const rentMonthly = rentReserveMonthly(settings)
  if (rentMonthly > 0) items.push({ type: 'rent', label: 'Rent reserve', amount: rentMonthly, date: null })

  return items.sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return a.date < b.date ? -1 : 1
  })
}

// Categories with a budget set, and how much of it has been spent in the given range.
export function budgetProgress(categories, transactions, range) {
  const rows = inRange(transactions, range).filter((txn) => txn.type === 'expense')

  return categories
    .filter((category) => !category.archived && category.budget != null && category.budget > 0)
    .map((category) => {
      const spent = round2(
        rows.filter((txn) => txn.category === category.name).reduce((sum, txn) => sum + Number(txn.amount || 0), 0)
      )
      return { category, spent, budget: category.budget, pct: Math.min(100, round2((spent / category.budget) * 100)) }
    })
}
