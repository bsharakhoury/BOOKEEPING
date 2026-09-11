import { describe, expect, it } from 'vitest'
import { normaliseMerchant } from '../../src/lib/parsers/merchants.js'

describe('normaliseMerchant', () => {
  it('maps the MAJID AL FUTTAIM HM alias to Carrefour', () => {
    expect(normaliseMerchant('MAJID AL FUTTAIM HM, Dubai')).toBe('Carrefour')
  })

  it('drops a trailing ", City" segment and title-cases the rest', () => {
    expect(normaliseMerchant('CAREEM QUIK, Abu Dhabi')).toBe('Careem Quik')
  })

  it('drops a parenthetical foreign-amount note', () => {
    expect(normaliseMerchant('DISTROKID MUSICIAN, +14153666101 (USD 24.99)')).toBe('Distrokid Musician')
  })

  it('returns an empty string for empty input', () => {
    expect(normaliseMerchant('')).toBe('')
    expect(normaliseMerchant(null)).toBe('')
  })
})
