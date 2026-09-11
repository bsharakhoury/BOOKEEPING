import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../ui/Modal.jsx'
import { Field } from '../ui/Field.jsx'
import { Card } from '../ui/Card.jsx'
import { ConfirmInline } from '../ui/ConfirmInline.jsx'
import { useToast } from '../ui/Toast.jsx'
import { usePersistedState } from '../../lib/storage.js'
import { generateId } from '../../lib/id.js'
import { formatMoney } from '../../lib/money.js'
import { formatDate, todayISO } from '../../lib/dates.js'
import { periodDueDate, periodKeyForDate, periodLabel } from '../../data/vatPeriods.js'
import { vatForPeriod } from '../../lib/derive/vat.js'
import { invoiceTotal, invoiceVatAmount, lineAmount } from '../../lib/derive/invoices.js'
import { downloadCsv } from '../../lib/csvExport.js'

const ADJUSTMENT_KINDS = [
  { id: 'output', label: 'Output (sales)' },
  { id: 'input', label: 'Input (purchases)' }
]

function emptyAdjustmentForm() {
  return { date: todayISO(), kind: 'output', amount: '', vat: '', description: '' }
}

function AdjustmentModal({ open, onClose, onSave }) {
  const [form, setForm] = useState(emptyAdjustmentForm)

  useEffect(() => {
    if (open) setForm(emptyAdjustmentForm())
  }, [open])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!form.amount || !form.description.trim()) return
    onSave({
      date: form.date,
      kind: form.kind,
      amount: Number(form.amount),
      vat: Number(form.vat) || 0,
      description: form.description.trim()
    })
  }

  return (
    <Modal open={open} title="Add VAT adjustment" onClose={onClose}>
      <form className="settings-form" onSubmit={handleSubmit}>
        <Field label="Date">
          <input type="date" value={form.date} onChange={(event) => updateField('date', event.target.value)} required />
        </Field>
        <Field label="Kind">
          <select value={form.kind} onChange={(event) => updateField('kind', event.target.value)}>
            {ADJUSTMENT_KINDS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Taxable amount (AED)">
          <input type="number" step="0.01" value={form.amount} onChange={(event) => updateField('amount', event.target.value)} required />
        </Field>
        <Field label="VAT (AED)">
          <input type="number" step="0.01" value={form.vat} onChange={(event) => updateField('vat', event.target.value)} />
        </Field>
        <Field label="Description">
          <input value={form.description} onChange={(event) => updateField('description', event.target.value)} required />
        </Field>
        <div className="transaction-form__actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Add adjustment
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Vat() {
  const [invoices] = usePersistedState('invoices', [])
  const [transactions] = usePersistedState('transactions', [])
  const [vatAdjustments, setVatAdjustments] = usePersistedState('vatAdjustments', [])
  const [settings] = usePersistedState('settings', { vatTrn: '' })
  const showToast = useToast()

  const [adjustmentModalOpen, setAdjustmentModalOpen] = useState(false)

  const periodKeys = useMemo(() => {
    const keys = new Set([periodKeyForDate(todayISO())])
    invoices.forEach((invoice) => keys.add(periodKeyForDate(invoice.issueDate)))
    transactions.forEach((txn) => keys.add(periodKeyForDate(txn.date)))
    vatAdjustments.forEach((adjustment) => keys.add(periodKeyForDate(adjustment.date)))
    return Array.from(keys)
      .filter(Boolean)
      .sort()
      .reverse()
  }, [invoices, transactions, vatAdjustments])

  const [selectedPeriod, setSelectedPeriod] = useState(() => periodKeyForDate(todayISO()))

  useEffect(() => {
    if (!periodKeys.includes(selectedPeriod) && periodKeys.length > 0) setSelectedPeriod(periodKeys[0])
  }, [periodKeys, selectedPeriod])

  const result = useMemo(
    () => vatForPeriod(selectedPeriod, { invoices, transactions, vatAdjustments }),
    [selectedPeriod, invoices, transactions, vatAdjustments]
  )

  const periodAdjustments = useMemo(
    () => vatAdjustments.filter((adjustment) => periodKeyForDate(adjustment.date) === selectedPeriod),
    [vatAdjustments, selectedPeriod]
  )

  const dueDate = periodDueDate(selectedPeriod)
  const daysToDeadline = dueDate ? Math.ceil((new Date(dueDate) - new Date(todayISO())) / 86400000) : null

  function saveAdjustment(fields) {
    setVatAdjustments((prev) => [...prev, { id: generateId(), ...fields }])
    setAdjustmentModalOpen(false)
  }

  function deleteAdjustment(adjustment) {
    setVatAdjustments((prev) => prev.filter((a) => a !== adjustment))
    showToast('Deleted adjustment', { actionLabel: 'Undo', onAction: () => setVatAdjustments((prev) => [...prev, adjustment]) })
  }

  function handleExportCsv() {
    const rows = [['No.', 'Date', 'Invoice No.', 'Client/Supplier Name', 'Taxable Amount', 'Tax', 'Total']]
    let rowNumber = 1

    invoices
      .filter((invoice) => periodKeyForDate(invoice.issueDate) === selectedPeriod)
      .forEach((invoice) => {
        const taxable = invoice.lines.reduce((sum, line) => sum + (line.vatTreatment !== 'out_of_scope' ? lineAmount(line) : 0), 0)
        rows.push([
          rowNumber++,
          invoice.issueDate,
          invoice.number,
          invoice.client,
          taxable.toFixed(2),
          invoiceVatAmount(invoice).toFixed(2),
          invoiceTotal(invoice).toFixed(2)
        ])
      })

    transactions
      .filter(
        (txn) => txn.ledger === 'lh_business' && txn.reclaimable && txn.docType === 'Tax Invoice' && periodKeyForDate(txn.date) === selectedPeriod
      )
      .forEach((txn) => {
        const vat = Number(txn.inputVat) || 0
        rows.push([rowNumber++, txn.date, '', txn.merchant, (Number(txn.amount) - vat).toFixed(2), vat.toFixed(2), Number(txn.amount).toFixed(2)])
      })

    downloadCsv(`vat-${selectedPeriod}.csv`, rows)
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>VAT</h1>
        <button type="button" onClick={handleExportCsv}>
          Export period CSV
        </button>
      </div>

      <div className="chip-row">
        {periodKeys.map((key) => (
          <button
            key={key}
            type="button"
            className={key === selectedPeriod ? 'chip-toggle chip-toggle--active' : 'chip-toggle'}
            onClick={() => setSelectedPeriod(key)}
          >
            {periodLabel(key)}
          </button>
        ))}
      </div>

      <p className="settings-hint">
        {settings.vatTrn ? `TRN ${settings.vatTrn} · ` : ''}
        Due {dueDate ? formatDate(dueDate) : '—'}
        {daysToDeadline != null && daysToDeadline >= 0 ? ` · ${daysToDeadline} day${daysToDeadline === 1 ? '' : 's'} left` : ''}
      </p>

      <div className="vat-boxes">
        <Card title="Output VAT (sales)">
          <ul className="vat-box-list">
            <li>
              <span>Standard-rated</span>
              <span>
                {formatMoney(result.output.standardTaxable)} taxable · {formatMoney(result.output.standardVat)} VAT
              </span>
            </li>
            <li>
              <span>Zero-rated</span>
              <span>{formatMoney(result.output.zeroTaxable)}</span>
            </li>
            <li>
              <span>Exempt</span>
              <span>{formatMoney(result.output.exemptTaxable)}</span>
            </li>
            <li>
              <span>Adjustments</span>
              <span>
                {formatMoney(result.output.adjustmentTaxable)} taxable · {formatMoney(result.output.adjustmentVat)} VAT
              </span>
            </li>
            <li className="vat-box-list__total">
              <span>Total</span>
              <span>
                {formatMoney(result.output.totalTaxable)} taxable · <strong>{formatMoney(result.output.totalVat)} VAT</strong>
              </span>
            </li>
          </ul>
        </Card>

        <Card title="Input VAT (purchases)">
          <ul className="vat-box-list">
            <li>
              <span>Reclaimable (RAK, Tax Invoice on file)</span>
              <span>
                {formatMoney(result.input.taxable)} taxable · {formatMoney(result.input.vat)} VAT
              </span>
            </li>
            <li>
              <span>Adjustments</span>
              <span>
                {formatMoney(result.input.adjustmentTaxable)} taxable · {formatMoney(result.input.adjustmentVat)} VAT
              </span>
            </li>
            <li className="vat-box-list__total">
              <span>Total</span>
              <span>
                {formatMoney(result.input.totalTaxable)} taxable · <strong>{formatMoney(result.input.totalVat)} VAT</strong>
              </span>
            </li>
          </ul>
        </Card>

        <Card title="Net payable" className="vat-net-card">
          <span className={`money money--${result.netPayable >= 0 ? 'expense' : 'income'}`}>{formatMoney(result.netPayable)}</span>
          <p className="settings-hint">Output VAT minus input VAT for this period.</p>
        </Card>
      </div>

      <section className="settings-section">
        <div className="screen-header">
          <h2>Adjustments</h2>
          <button type="button" className="primary" onClick={() => setAdjustmentModalOpen(true)}>
            Add adjustment
          </button>
        </div>
        {periodAdjustments.length === 0 ? (
          <p className="settings-hint">No manual adjustments for this period.</p>
        ) : (
          <ul className="settings-list">
            {periodAdjustments.map((adjustment, index) => (
              <li key={index} className="settings-list__item">
                <span>{adjustment.description}</span>
                <span className="settings-list__meta">
                  {formatDate(adjustment.date)} · {ADJUSTMENT_KINDS.find((k) => k.id === adjustment.kind)?.label}
                </span>
                <span className="money money--expense">
                  {formatMoney(adjustment.amount)} / {formatMoney(adjustment.vat)} VAT
                </span>
                <ConfirmInline label="Delete" confirmLabel="Confirm" onConfirm={() => deleteAdjustment(adjustment)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <AdjustmentModal open={adjustmentModalOpen} onClose={() => setAdjustmentModalOpen(false)} onSave={saveAdjustment} />
    </div>
  )
}
