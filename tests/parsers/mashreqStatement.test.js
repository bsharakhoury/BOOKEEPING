import { describe, expect, it } from 'vitest'
import { categoriseMashreqDescription, parseMashreqStatementRows } from '../../src/lib/parsers/mashreqStatement.js'

describe('categoriseMashreqDescription', () => {
  it('classifies a Visa purchase as a personal expense', () => {
    const result = categoriseMashreqDescription(
      'Visa Purchase 259 0630 316628 SMARTDXBGOV-PRKN AED DUBAI AE AED 27.3 0630'
    )
    expect(result).toMatchObject({ type: 'expense', category: 'Personal expenses', ledger: 'personal', ruleId: 'STMT_VISA_PURCHASE' })
    expect(result.rawMerchant).toContain('SMARTDXBGOV-PRKN')
  })

  it('classifies a Visa refund as a refund against income ledger', () => {
    const result = categoriseMashreqDescription('Visa Refund 713585314000PREMIUM CAR RENTALS DMCC')
    expect(result).toMatchObject({ type: 'refund', category: 'Refund', ledger: 'income', ruleId: 'STMT_VISA_REFUND' })
  })

  it('classifies an IPP transfer as a personal expense naming the recipient', () => {
    const result = categoriseMashreqDescription(
      'IPP TRANSFER AE550340003708492992901 - MUHAMMAD HUZAIFA - /REF/ PERSONAL, CULTURAL, AUDIOVISUAL AND RECREATIONAL SERVICES - T_AD1F76943669493FB96F7F419DAC385A'
    )
    expect(result).toMatchObject({ type: 'expense', category: 'Personal expenses', ledger: 'personal', ruleId: 'STMT_IPP_TRANSFER' })
    expect(result.rawMerchant).toBe('Transfer to MUHAMMAD HUZAIFA')
  })

  it('classifies an IPP transfer whose segments use a code instead of /REF/', () => {
    const result = categoriseMashreqDescription(
      'IPP TRANSFER AE410340003578254790502 - NIZAR M SHEHADA - MP_2_P - ALLOWANCE - 202607040006B98111133210479'
    )
    expect(result).toMatchObject({ type: 'expense', ruleId: 'STMT_IPP_TRANSFER' })
    expect(result.rawMerchant).toBe('Transfer to NIZAR M SHEHADA')
  })

  it('classifies an account-to-account transfer as a transfer, excluded from totals', () => {
    const result = categoriseMashreqDescription('Acct to Acct transfer FUND TRANSFER - 019010650370 - BECHARA EL KHOURY')
    expect(result).toMatchObject({ type: 'transfer', ruleId: 'STMT_ACCT_TO_ACCT' })
  })

  it('classifies a salary credit', () => {
    const result = categoriseMashreqDescription('Salary    WPS26040911552450 BENO TECHNOLOGIES FZCO')
    expect(result).toMatchObject({ type: 'income', category: 'Salary – Beno', ledger: 'income', ruleId: 'STMT_SALARY' })
  })

  it('classifies an ATM cash withdrawal', () => {
    const result = categoriseMashreqDescription('ATM Cash Withdrawal E4011907 EMIRATES BANK INTL DUBAI D AE AED ATM CASH WITHDRAWAL 03-AUG-26 185436')
    expect(result).toMatchObject({ type: 'expense', category: 'Cash Withdrawal', ledger: 'personal', ruleId: 'STMT_ATM_WITHDRAWAL' })
  })

  it('classifies a joining benefit as a bank bonus', () => {
    const result = categoriseMashreqDescription('Joining Benefit - Happiness Account NEOSALARYBONUS 1/6')
    expect(result).toMatchObject({ type: 'income', category: 'Bank Bonus', ledger: 'income', ruleId: 'STMT_JOINING_BENEFIT' })
  })

  it('classifies a breach-of-minimum-balance fee and its VAT line as bank fees', () => {
    expect(categoriseMashreqDescription('Breach of Min Balance BREACH OF MIN BALANCE')).toMatchObject({ ruleId: 'STMT_BANK_FEE', type: 'expense' })
    expect(categoriseMashreqDescription('Value Added Tax - Output BREACH OF MIN BALANCE')).toMatchObject({ ruleId: 'STMT_BANK_FEE', type: 'expense' })
  })

  it('falls back to a generic income/expense bucket for anything unrecognised', () => {
    expect(categoriseMashreqDescription('Some Brand New Fee Type', { isCredit: false })).toMatchObject({ ruleId: 'STMT_UNRECOGNISED', type: 'expense' })
    expect(categoriseMashreqDescription('Some Brand New Credit Type', { isCredit: true })).toMatchObject({ ruleId: 'STMT_UNRECOGNISED', type: 'income' })
  })
})

describe('parseMashreqStatementRows', () => {
  const HEADER = ['Date', 'Value Date', 'Reference Number', 'Description', 'Credit', 'Debit', 'Balance']

  it('skips metadata/header rows and only reads rows with a real statement date', () => {
    const rows = [
      ['Account Holder Name', 'TEST USER'],
      HEADER,
      ['01 Jul 2026', '01 Jul 2026', 'REF001', 'Visa Purchase 259 0630 111111 TEST MART AED DUBAI AE AED 10 0630', '', '-10.00', '990.00']
    ]
    expect(parseMashreqStatementRows(rows)).toHaveLength(1)
  })

  it('maps a debit row to an expense with the statement amount, no FX conversion', () => {
    const rows = [
      ['02 Jul 2026', '02 Jul 2026', 'REF002', 'Visa Purchase 259 0701 222222 TEST CAFE AED DUBAI AE AED 24.5 0701', '', '-24.50', '965.50']
    ]
    const [txn] = parseMashreqStatementRows(rows)
    expect(txn).toMatchObject({
      date: '2026-07-02',
      amount: 24.5,
      currency: 'AED',
      fxRate: 1,
      fxAmount: 24.5,
      type: 'expense',
      paymentMethod: 'Mashreq Debit 9437',
      ledger: 'personal',
      bankRef: 'REF002'
    })
  })

  it('maps a credit row to income using the Credit column', () => {
    const rows = [['03 Jul 2026', '03 Jul 2026', 'REF003', 'Salary    WPS26070310485073 BENO TECHNOLOGIES FZCO', '+6,000.00', '', '6,965.50']]
    const [txn] = parseMashreqStatementRows(rows)
    expect(txn).toMatchObject({ date: '2026-07-03', amount: 6000, type: 'income', category: 'Salary – Beno', ledger: 'income' })
  })

  it('skips a row with neither a credit nor a debit amount', () => {
    const rows = [['04 Jul 2026', '04 Jul 2026', 'REF004', 'Some non-transaction line', '', '', '6,965.50']]
    expect(parseMashreqStatementRows(rows)).toHaveLength(0)
  })

  it('gives transfer-type rows the placeholder Transfer category, matching the rest of the app', () => {
    const rows = [['05 Jul 2026', '05 Jul 2026', 'REF005', 'Acct to Acct transfer FUND TRANSFER - 019010650370 - TEST USER', '', '-400.00', '6,565.50']]
    const [txn] = parseMashreqStatementRows(rows)
    expect(txn.category).toBe('Transfer')
  })
})
