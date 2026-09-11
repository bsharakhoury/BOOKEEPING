const AED_FORMATTER = new Intl.NumberFormat('en-AE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

export function formatMoney(amount, { showSign = false } = {}) {
  const value = Number(amount) || 0
  const formatted = AED_FORMATTER.format(Math.abs(value))
  const sign = showSign && value !== 0 ? (value < 0 ? '−' : '+') : value < 0 ? '−' : ''
  return `${sign}${formatted}`
}

export function parseMoney(input) {
  if (typeof input === 'number') return input
  const cleaned = String(input).replace(/[^0-9.-]/g, '')
  const value = parseFloat(cleaned)
  return Number.isFinite(value) ? value : 0
}
