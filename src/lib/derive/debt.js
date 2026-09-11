import { addMonths, todayISO } from '../dates.js'

const MAX_MONTHS = 1200 // 100-year safety cap against runaway loops

function round2(value) {
  return Math.round(value * 100) / 100
}

// Single-debt amortization projection. `interest` is an annual percentage rate (e.g. 24 for
// 24% APR); monthlyPayment defaults to the debt's own monthlyMin plus any extra.
export function payoffProjection(debt, { extraMonthly = 0, today = todayISO() } = {}) {
  const monthlyRate = (Number(debt.interest) || 0) / 100 / 12
  const payment = (Number(debt.monthlyMin) || 0) + extraMonthly
  let balance = Number(debt.remaining) || 0

  if (balance <= 0) {
    return { months: 0, totalInterest: 0, payoffDate: today, payable: true }
  }
  if (payment <= 0) {
    return { months: Infinity, totalInterest: Infinity, payoffDate: null, payable: false }
  }

  let months = 0
  let totalInterest = 0

  while (balance > 0 && months < MAX_MONTHS) {
    const interest = balance * monthlyRate
    let principal = payment - interest
    if (principal <= 0) {
      // the payment doesn't even cover interest — balance never shrinks
      return { months: Infinity, totalInterest: Infinity, payoffDate: null, payable: false }
    }
    if (principal > balance) principal = balance
    balance = round2(balance - principal)
    totalInterest += interest
    months += 1
  }

  return { months, totalInterest: round2(totalInterest), payoffDate: addMonths(today, months), payable: true }
}

// Projects payoff across every active debt at once, directing a shared extra-payment pool
// (plus any minimums freed up as debts get paid off) at the highest-priority debt still owing —
// highest interest first for 'avalanche', smallest balance first for 'snowball'.
export function multiDebtProjection(debts, { extraMonthly = 0, strategy = 'avalanche', today = todayISO() } = {}) {
  const active = debts.filter((debt) => debt.status !== 'settled' && (Number(debt.remaining) || 0) > 0)
  if (active.length === 0) {
    return { months: 0, totalInterest: 0, payoffDate: today, order: [] }
  }

  const ordered = [...active].sort((a, b) =>
    strategy === 'snowball'
      ? (Number(a.remaining) || 0) - (Number(b.remaining) || 0)
      : (Number(b.interest) || 0) - (Number(a.interest) || 0)
  )

  const balances = new Map(ordered.map((debt) => [debt.id, Number(debt.remaining) || 0]))
  const rates = new Map(ordered.map((debt) => [debt.id, (Number(debt.interest) || 0) / 100 / 12]))
  const minimums = new Map(ordered.map((debt) => [debt.id, Number(debt.monthlyMin) || 0]))
  const payoffMonth = new Map()

  let months = 0
  let totalInterest = 0

  while ([...balances.values()].some((balance) => balance > 0) && months < MAX_MONTHS) {
    months += 1
    let pool = extraMonthly

    for (const debt of ordered) {
      const balance = balances.get(debt.id)
      if (balance <= 0) {
        pool += minimums.get(debt.id) // this debt's minimum snowballs into the pool once it's paid off
        continue
      }
      const interest = balance * rates.get(debt.id)
      totalInterest += interest
      const afterInterest = balance + interest
      const applied = Math.min(minimums.get(debt.id), afterInterest)
      const newBalance = round2(afterInterest - applied)
      balances.set(debt.id, newBalance)
      if (newBalance <= 0 && !payoffMonth.has(debt.id)) payoffMonth.set(debt.id, months)
    }

    for (const debt of ordered) {
      if (pool <= 0) break
      const balance = balances.get(debt.id)
      if (balance <= 0) continue
      const applied = Math.min(pool, balance)
      const newBalance = round2(balance - applied)
      balances.set(debt.id, newBalance)
      pool -= applied
      if (newBalance <= 0 && !payoffMonth.has(debt.id)) payoffMonth.set(debt.id, months)
    }
  }

  return {
    months,
    totalInterest: round2(totalInterest),
    payoffDate: addMonths(today, months),
    order: ordered.map((debt) => ({ id: debt.id, name: debt.name, payoffMonth: payoffMonth.get(debt.id) ?? months }))
  }
}
