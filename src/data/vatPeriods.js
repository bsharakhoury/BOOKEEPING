// UAE FTA quarterly VAT periods used for Leaf & Hook FZ LLC.
export const VAT_PERIODS = [
  { id: 'mar-may', label: 'Mar – May', startMonth: 3, endMonth: 5, dueMonth: 6, dueDay: 29 },
  { id: 'jun-aug', label: 'Jun – Aug', startMonth: 6, endMonth: 8, dueMonth: 9, dueDay: 28 },
  { id: 'sep-nov', label: 'Sep – Nov', startMonth: 9, endMonth: 11, dueMonth: 12, dueDay: 29 },
  { id: 'dec-feb', label: 'Dec – Feb', startMonth: 12, endMonth: 2, dueMonth: 3, dueDay: 29 }
]

export function periodForMonth(month) {
  return VAT_PERIODS.find((period) => {
    if (period.startMonth <= period.endMonth) {
      return month >= period.startMonth && month <= period.endMonth
    }
    return month >= period.startMonth || month <= period.endMonth
  })
}

// A period repeats every year, so aggregating VAT needs a year-qualified key, not just the
// period id. The key uses the period's STARTING year — e.g. Dec 2026 and the following Jan/Feb
// 2027 both belong to "2026-dec-feb".
export function periodKeyForDate(dateStr) {
  if (!dateStr) return null
  const [yearStr, monthStr] = String(dateStr).split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)
  const period = periodForMonth(month)
  if (!period || !year) return null
  const periodYear = period.startMonth > period.endMonth && month <= period.endMonth ? year - 1 : year
  return `${periodYear}-${period.id}`
}

export function parsePeriodKey(periodKey) {
  const [yearStr, ...idParts] = String(periodKey).split('-')
  const id = idParts.join('-')
  const period = VAT_PERIODS.find((p) => p.id === id)
  const year = Number(yearStr)
  if (!period || !year) return null
  return { ...period, year }
}

export function periodDueDate(periodKey) {
  const parsed = parsePeriodKey(periodKey)
  if (!parsed) return null
  const dueYear = parsed.dueMonth < parsed.startMonth ? parsed.year + 1 : parsed.year
  return `${dueYear}-${String(parsed.dueMonth).padStart(2, '0')}-${String(parsed.dueDay).padStart(2, '0')}`
}

export function periodLabel(periodKey) {
  const parsed = parsePeriodKey(periodKey)
  if (!parsed) return periodKey
  const endYear = parsed.startMonth > parsed.endMonth ? parsed.year + 1 : parsed.year
  return `${parsed.label} ${parsed.year}${endYear !== parsed.year ? `/${String(endYear).slice(2)}` : ''}`
}
