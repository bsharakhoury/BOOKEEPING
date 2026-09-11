import { monthKey, todayISO } from '../dates.js'

function round2(value) {
  return Math.round(value * 100) / 100
}

// Months required to reach a goal's target by its targetDate, given what's saved already.
export function requiredMonthlyForGoal(goal, today = todayISO()) {
  const remaining = (Number(goal.target) || 0) - (Number(goal.current) || 0)
  if (remaining <= 0 || !goal.targetDate) return 0

  const now = new Date(today)
  const due = new Date(goal.targetDate)
  const months = Math.max(1, (due.getFullYear() - now.getFullYear()) * 12 + (due.getMonth() - now.getMonth()))
  return round2(remaining / months)
}

// Rent is paid every `rentCycleMonths` months — this is the monthly amount to set aside so the
// next payment is covered. Matches the brief's own example: 12,500 / 3 = 4,166.67/month.
export function rentReserveMonthly(settings) {
  const rent = Number(settings?.rent) || 0
  const cycleMonths = Number(settings?.rentCycleMonths) || 1
  return round2(rent / cycleMonths)
}

// "Essential" personal categories — necessities, not discretionary spend — used as the base for
// the emergency-fund target. A judgement call: no such list is specified in the brief.
export const ESSENTIAL_CATEGORIES = [
  'Food (Groceries)',
  'Transport (Public/Taxi)',
  'Transport (Fuel)',
  'Utilities',
  'Personal utilities',
  'Home',
  'Rent'
]

// 3x the rolling average of monthly essential spend over the last `windowMonths` COMPLETE
// months (the current, still-in-progress month is excluded so partial data doesn't skew it).
export function emergencyFundTarget(transactions, { multiplier = 3, windowMonths = 3, today = todayISO() } = {}) {
  const essentials = new Set(ESSENTIAL_CATEGORIES)
  const currentMonth = monthKey(today)
  const monthTotals = new Map()

  transactions.forEach((txn) => {
    if (txn.type !== 'expense' || !essentials.has(txn.category)) return
    const key = monthKey(txn.date)
    if (key >= currentMonth) return
    monthTotals.set(key, (monthTotals.get(key) || 0) + (Number(txn.amount) || 0))
  })

  const recentMonths = Array.from(monthTotals.keys()).sort().reverse().slice(0, windowMonths)
  if (recentMonths.length === 0) return 0

  const average = recentMonths.reduce((sum, key) => sum + monthTotals.get(key), 0) / recentMonths.length
  return round2(average * multiplier)
}
