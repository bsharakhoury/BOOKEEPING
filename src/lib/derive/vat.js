import { periodKeyForDate } from '../../data/vatPeriods.js'
import { lineAmount, lineVat } from './invoices.js'

function round2(value) {
  return Math.round(value * 100) / 100
}

function emptyBox() {
  return { standardTaxable: 0, standardVat: 0, zeroTaxable: 0, exemptTaxable: 0, adjustmentTaxable: 0, adjustmentVat: 0 }
}

// FTA-style box layout for one period: output VAT from invoice lines (by treatment), input VAT
// from lh_business transactions that are reclaimable AND have a Tax Invoice on file, plus any
// manual vatAdjustments for the period. Matched by each record's own `date` (adjustments carry a
// `date` field even though it isn't in the original documented shape — see legacyImport.js).
export function vatForPeriod(periodKey, { invoices = [], transactions = [], vatAdjustments = [] } = {}) {
  const output = emptyBox()

  invoices.forEach((invoice) => {
    if (periodKeyForDate(invoice.issueDate) !== periodKey) return
    ;(invoice.lines || []).forEach((line) => {
      const amount = lineAmount(line)
      if (line.vatTreatment === 'standard') {
        output.standardTaxable = round2(output.standardTaxable + amount)
        output.standardVat = round2(output.standardVat + lineVat(line))
      } else if (line.vatTreatment === 'zero') {
        output.zeroTaxable = round2(output.zeroTaxable + amount)
      } else if (line.vatTreatment === 'exempt') {
        output.exemptTaxable = round2(output.exemptTaxable + amount)
      }
      // 'out_of_scope' lines are excluded from the VAT return entirely.
    })
  })

  let inputTaxable = 0
  let inputVatTotal = 0
  transactions.forEach((txn) => {
    if (txn.ledger !== 'lh_business' || !txn.reclaimable || txn.docType !== 'Tax Invoice') return
    if (periodKeyForDate(txn.date) !== periodKey) return
    const vat = Number(txn.inputVat) || 0
    inputVatTotal = round2(inputVatTotal + vat)
    inputTaxable = round2(inputTaxable + round2((Number(txn.amount) || 0) - vat))
  })

  const input = { taxable: inputTaxable, vat: inputVatTotal, adjustmentTaxable: 0, adjustmentVat: 0 }

  vatAdjustments.forEach((adjustment) => {
    if (periodKeyForDate(adjustment.date) !== periodKey) return
    const amount = Number(adjustment.amount) || 0
    const vat = Number(adjustment.vat) || 0
    if (adjustment.kind === 'output') {
      output.adjustmentTaxable = round2(output.adjustmentTaxable + amount)
      output.adjustmentVat = round2(output.adjustmentVat + vat)
    } else if (adjustment.kind === 'input') {
      input.adjustmentTaxable = round2(input.adjustmentTaxable + amount)
      input.adjustmentVat = round2(input.adjustmentVat + vat)
    }
  })

  const outputTotalTaxable = round2(output.standardTaxable + output.zeroTaxable + output.exemptTaxable + output.adjustmentTaxable)
  const outputTotalVat = round2(output.standardVat + output.adjustmentVat)
  const inputTotalTaxable = round2(input.taxable + input.adjustmentTaxable)
  const inputTotalVat = round2(input.vat + input.adjustmentVat)

  return {
    period: periodKey,
    output: { ...output, totalTaxable: outputTotalTaxable, totalVat: outputTotalVat },
    input: { ...input, totalTaxable: inputTotalTaxable, totalVat: inputTotalVat },
    netPayable: round2(outputTotalVat - inputTotalVat)
  }
}
