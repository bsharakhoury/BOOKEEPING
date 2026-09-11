export const DEFAULT_FX_RATES = { USD: 3.674, EUR: 4.02, GBP: 4.73 }

export function toAED(amount, currency, rates = DEFAULT_FX_RATES) {
  if (!currency || currency === 'AED') return Number(amount) || 0
  const rate = rates[currency]
  return rate ? (Number(amount) || 0) * rate : Number(amount) || 0
}
