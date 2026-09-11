import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../ui/Modal.jsx'
import { Field } from '../ui/Field.jsx'
import { Table } from '../ui/Table.jsx'
import { Chip } from '../ui/Chip.jsx'
import { ConfirmInline } from '../ui/ConfirmInline.jsx'
import { useToast } from '../ui/Toast.jsx'
import { usePersistedState } from '../../lib/storage.js'
import { generateId } from '../../lib/id.js'
import { formatMoney } from '../../lib/money.js'
import { formatDate, todayISO } from '../../lib/dates.js'
import {
  clientTotals,
  expectedPayments,
  invoicePaidTotal,
  invoiceRemaining,
  invoiceStatus,
  invoiceSubtotal,
  invoiceTotal,
  invoiceVatAmount,
  lineAmount,
  nextInvoiceNumber
} from '../../lib/derive/invoices.js'

const VAT_TREATMENTS = [
  { id: 'standard', label: 'Standard (5%)' },
  { id: 'zero', label: 'Zero-rated' },
  { id: 'exempt', label: 'Exempt' },
  { id: 'out_of_scope', label: 'Out of scope' }
]

const STATUS_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'partial', label: 'Partial' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'paid', label: 'Paid' }
]

const STATUS_LABELS = { unpaid: 'Unpaid', partial: 'Partial', overdue: 'Overdue', paid: 'Paid' }

const PAYMENT_KINDS = [
  { id: 'down', label: 'Down payment' },
  { id: 'second', label: 'Second payment' },
  { id: 'final', label: 'Final payment' },
  { id: 'full', label: 'Full payment' },
  { id: 'refund', label: 'Refund' }
]

function emptyLine() {
  return { description: '', qty: 1, unitPrice: '', vatTreatment: 'standard' }
}

function emptyInvoiceForm() {
  return {
    client: '',
    project: '',
    issueDate: todayISO(),
    dueDate: '',
    currency: 'AED',
    fxRate: '1',
    notes: '',
    docLink: '',
    lines: [emptyLine()]
  }
}

function InvoiceModal({ open, editing, onClose, onSave }) {
  const [form, setForm] = useState(emptyInvoiceForm)

  useEffect(() => {
    if (!open) return
    setForm(
      editing
        ? {
            client: editing.client || '',
            project: editing.project || '',
            issueDate: editing.issueDate || todayISO(),
            dueDate: editing.dueDate || '',
            currency: editing.currency || 'AED',
            fxRate: String(editing.fxRate ?? '1'),
            notes: editing.notes || '',
            docLink: editing.docLink || '',
            lines: editing.lines && editing.lines.length > 0 ? editing.lines.map((line) => ({ ...line })) : [emptyLine()]
          }
        : emptyInvoiceForm()
    )
  }, [open, editing])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function updateLine(index, field, value) {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line, i) => (i === index ? { ...line, [field]: value } : line))
    }))
  }

  function addLine() {
    setForm((prev) => ({ ...prev, lines: [...prev.lines, emptyLine()] }))
  }

  function removeLine(index) {
    setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }))
  }

  const previewSubtotal = form.lines.reduce((sum, line) => sum + lineAmount({ ...line, qty: Number(line.qty) || 0, unitPrice: Number(line.unitPrice) || 0 }), 0)

  function handleSubmit(event) {
    event.preventDefault()
    if (!form.client.trim() || !form.issueDate) return
    const lines = form.lines
      .filter((line) => line.description.trim() && line.unitPrice !== '')
      .map((line) => ({ description: line.description.trim(), qty: Number(line.qty) || 0, unitPrice: Number(line.unitPrice) || 0, vatTreatment: line.vatTreatment }))
    if (lines.length === 0) return

    onSave({
      client: form.client.trim(),
      project: form.project.trim(),
      issueDate: form.issueDate,
      dueDate: form.dueDate || null,
      currency: form.currency || 'AED',
      fxRate: Number(form.fxRate) || 1,
      notes: form.notes.trim(),
      docLink: form.docLink.trim() || null,
      lines
    })
  }

  return (
    <Modal open={open} title={editing ? `Edit ${editing.number}` : 'New invoice'} onClose={onClose}>
      <form className="settings-form" onSubmit={handleSubmit}>
        <Field label="Client">
          <input value={form.client} onChange={(event) => updateField('client', event.target.value)} required />
        </Field>
        <Field label="Project" hint="optional">
          <input value={form.project} onChange={(event) => updateField('project', event.target.value)} />
        </Field>
        <Field label="Issue date">
          <input type="date" value={form.issueDate} onChange={(event) => updateField('issueDate', event.target.value)} required />
        </Field>
        <Field label="Due date" hint="optional">
          <input type="date" value={form.dueDate} onChange={(event) => updateField('dueDate', event.target.value)} />
        </Field>
        <Field label="Currency">
          <input value={form.currency} onChange={(event) => updateField('currency', event.target.value)} />
        </Field>
        <Field label="FX rate" hint="to AED, 1 if already AED">
          <input type="number" min="0" step="0.0001" value={form.fxRate} onChange={(event) => updateField('fxRate', event.target.value)} />
        </Field>

        <div className="invoice-lines">
          <div className="screen-header">
            <span className="field__label">Lines</span>
            <button type="button" onClick={addLine}>
              Add line
            </button>
          </div>
          {form.lines.map((line, index) => (
            <div key={index} className="invoice-line-row">
              <input
                className="invoice-line-row__desc"
                placeholder="Description"
                value={line.description}
                onChange={(event) => updateLine(index, 'description', event.target.value)}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Qty"
                value={line.qty}
                onChange={(event) => updateLine(index, 'qty', event.target.value)}
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Unit price"
                value={line.unitPrice}
                onChange={(event) => updateLine(index, 'unitPrice', event.target.value)}
              />
              <select value={line.vatTreatment} onChange={(event) => updateLine(index, 'vatTreatment', event.target.value)}>
                {VAT_TREATMENTS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button type="button" className="link-button" onClick={() => removeLine(index)} disabled={form.lines.length === 1}>
                Remove
              </button>
            </div>
          ))}
          <p className="settings-hint">Subtotal: {formatMoney(previewSubtotal)}</p>
        </div>

        <Field label="Doc link" hint="optional">
          <input value={form.docLink} onChange={(event) => updateField('docLink', event.target.value)} />
        </Field>
        <Field label="Notes">
          <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} rows={2} />
        </Field>

        <div className="transaction-form__actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            {editing ? 'Save changes' : 'Create invoice'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function emptyPaymentForm() {
  return { date: todayISO(), amount: '', method: '', kind: 'down' }
}

function InvoiceDetail({ open, invoice, onClose, onEdit, onAddPayment, onPrint }) {
  const [form, setForm] = useState(emptyPaymentForm)

  useEffect(() => {
    if (open) setForm(emptyPaymentForm())
  }, [open, invoice])

  if (!invoice) return null

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!form.amount) return
    onAddPayment(invoice, { date: form.date, amount: Number(form.amount), method: form.method.trim(), kind: form.kind })
    setForm(emptyPaymentForm())
  }

  const status = invoiceStatus(invoice)

  return (
    <Modal open={open} title={`${invoice.number} — ${invoice.client}`} onClose={onClose}>
      <div className="invoice-detail">
        <p className="settings-hint">
          {invoice.project ? `${invoice.project} · ` : ''}Issued {formatDate(invoice.issueDate)}
          {invoice.dueDate ? ` · due ${formatDate(invoice.dueDate)}` : ''} · <strong>{STATUS_LABELS[status] || status}</strong>
        </p>

        <table className="table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>VAT</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={index}>
                <td>{line.description}</td>
                <td>{line.qty}</td>
                <td>{formatMoney(line.unitPrice)}</td>
                <td>{VAT_TREATMENTS.find((t) => t.id === line.vatTreatment)?.label ?? line.vatTreatment}</td>
                <td>{formatMoney(lineAmount(line))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="settings-hint">
          Subtotal {formatMoney(invoiceSubtotal(invoice))} · VAT {formatMoney(invoiceVatAmount(invoice))} · Total{' '}
          <strong>{formatMoney(invoiceTotal(invoice))}</strong> · Paid {formatMoney(invoicePaidTotal(invoice))} · Remaining{' '}
          <strong>{formatMoney(invoiceRemaining(invoice))}</strong>
        </p>

        <h3>Payments</h3>
        {invoice.payments.length === 0 ? (
          <p className="settings-hint">No payments logged yet.</p>
        ) : (
          <ul className="settings-list">
            {invoice.payments.map((payment, index) => (
              <li key={index} className="settings-list__item">
                <span>{PAYMENT_KINDS.find((k) => k.id === payment.kind)?.label ?? payment.kind}</span>
                <span className="settings-list__meta">
                  {formatDate(payment.date)} · {payment.method || '—'}
                </span>
                <span className={`money money--${payment.kind === 'refund' ? 'refund' : 'income'}`}>{formatMoney(payment.amount)}</span>
              </li>
            ))}
          </ul>
        )}

        <form className="settings-form" onSubmit={handleSubmit}>
          <Field label="Date">
            <input type="date" value={form.date} onChange={(event) => updateField('date', event.target.value)} required />
          </Field>
          <Field label="Amount (AED)">
            <input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => updateField('amount', event.target.value)} required />
          </Field>
          <Field label="Method" hint="optional">
            <input value={form.method} onChange={(event) => updateField('method', event.target.value)} />
          </Field>
          <Field label="Kind">
            <select value={form.kind} onChange={(event) => updateField('kind', event.target.value)}>
              {PAYMENT_KINDS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="transaction-form__actions">
            <button type="button" onClick={() => onPrint(invoice)}>
              Print
            </button>
            <button type="button" onClick={() => onEdit(invoice)}>
              Edit
            </button>
            <button type="submit" className="primary">
              Log payment
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

function InvoicePrintView({ invoice, onClose }) {
  if (!invoice) return null
  return (
    <div className="invoice-print-overlay">
      <div className="invoice-print-overlay__bar">
        <button type="button" onClick={onClose}>
          Close
        </button>
        <button type="button" className="primary" onClick={() => window.print()}>
          Print
        </button>
      </div>
      <div className="invoice-print">
        <h1>{invoice.number}</h1>
        <p>
          {invoice.client}
          {invoice.project ? ` — ${invoice.project}` : ''}
        </p>
        <p>
          Issued {formatDate(invoice.issueDate)}
          {invoice.dueDate ? ` · Due ${formatDate(invoice.dueDate)}` : ''}
        </p>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Qty</th>
              <th>Unit price</th>
              <th>VAT</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, index) => (
              <tr key={index}>
                <td>{line.description}</td>
                <td>{line.qty}</td>
                <td>{formatMoney(line.unitPrice)}</td>
                <td>{VAT_TREATMENTS.find((t) => t.id === line.vatTreatment)?.label ?? line.vatTreatment}</td>
                <td>{formatMoney(lineAmount(line))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="invoice-print__totals">
          Subtotal {formatMoney(invoiceSubtotal(invoice))} · VAT {formatMoney(invoiceVatAmount(invoice))} · Total{' '}
          {formatMoney(invoiceTotal(invoice))}
        </p>
        {invoice.notes && <p>{invoice.notes}</p>}
      </div>
    </div>
  )
}

export default function Invoices() {
  const [invoices, setInvoices] = usePersistedState('invoices', [])
  const showToast = useToast()

  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingInvoice, setEditingInvoice] = useState(null)
  const [detailInvoice, setDetailInvoice] = useState(null)
  const [printInvoice, setPrintInvoice] = useState(null)

  const withStatus = useMemo(() => invoices.map((invoice) => ({ ...invoice, _status: invoiceStatus(invoice) })), [invoices])

  const filtered = useMemo(
    () => (statusFilter === 'all' ? withStatus : withStatus.filter((invoice) => invoice._status === statusFilter)),
    [withStatus, statusFilter]
  )

  const expected = useMemo(() => expectedPayments(invoices), [invoices])
  const clients = useMemo(() => clientTotals(invoices), [invoices])

  function openAdd() {
    setEditingInvoice(null)
    setModalOpen(true)
  }

  function openEditFromDetail(invoice) {
    setDetailInvoice(null)
    setEditingInvoice(invoice)
    setModalOpen(true)
  }

  function handleSave(fields) {
    if (editingInvoice) {
      setInvoices((prev) => prev.map((invoice) => (invoice.id === editingInvoice.id ? { ...invoice, ...fields } : invoice)))
    } else {
      const newInvoice = { id: generateId(), number: nextInvoiceNumber(invoices), payments: [], ...fields }
      setInvoices((prev) => [newInvoice, ...prev])
    }
    setModalOpen(false)
  }

  function handleDelete(invoice) {
    setInvoices((prev) => prev.filter((i) => i.id !== invoice.id))
    showToast(`Deleted ${invoice.number}`, { actionLabel: 'Undo', onAction: () => setInvoices((prev) => [invoice, ...prev]) })
  }

  function handleAddPayment(invoice, payment) {
    setInvoices((prev) =>
      prev.map((i) => (i.id === invoice.id ? { ...i, payments: [...i.payments, { ...payment, txnId: null }] } : i))
    )
    setDetailInvoice((prev) => (prev && prev.id === invoice.id ? { ...prev, payments: [...prev.payments, payment] } : prev))
    showToast(`Logged ${formatMoney(payment.amount)} payment on ${invoice.number}`)
  }

  const columns = [
    {
      key: 'number',
      label: 'Number',
      render: (invoice) => (
        <button type="button" className="link-button" onClick={() => setDetailInvoice(invoice)}>
          {invoice.number}
        </button>
      )
    },
    { key: 'client', label: 'Client' },
    { key: 'issueDate', label: 'Issued', render: (invoice) => formatDate(invoice.issueDate) },
    { key: 'dueDate', label: 'Due', render: (invoice) => (invoice.dueDate ? formatDate(invoice.dueDate) : '—') },
    { key: 'total', label: 'Total', render: (invoice) => formatMoney(invoiceTotal(invoice)) },
    { key: 'remaining', label: 'Remaining', render: (invoice) => formatMoney(invoiceRemaining(invoice)) },
    { key: 'status', label: 'Status', render: (invoice) => STATUS_LABELS[invoice._status] || invoice._status },
    { key: 'actions', label: '', render: (invoice) => <ConfirmInline label="Delete" confirmLabel="Confirm" onConfirm={() => handleDelete(invoice)} /> }
  ]

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Invoices</h1>
        <button type="button" className="primary" data-shortcut="new" onClick={openAdd}>
          New invoice
        </button>
      </div>

      <div className="chip-row">
        {STATUS_CHIPS.map((chip) => (
          <Chip key={chip.id} label={chip.label} active={statusFilter === chip.id} onClick={() => setStatusFilter(chip.id)} />
        ))}
      </div>

      <Table columns={columns} rows={filtered} emptyMessage="No invoices yet." />

      <section className="settings-section">
        <h2>Expected payments</h2>
        {expected.length === 0 ? (
          <p className="settings-hint">Nothing outstanding.</p>
        ) : (
          <ul className="settings-list">
            {expected.map(({ invoice, remaining, dueSoon }) => (
              <li key={invoice.id} className="settings-list__item">
                <button type="button" className="link-button" onClick={() => setDetailInvoice(invoice)}>
                  {invoice.number} — {invoice.client}
                </button>
                <span className="settings-list__meta">{invoice.dueDate ? `Due ${formatDate(invoice.dueDate)}` : 'No due date'}</span>
                {dueSoon && <span className="dup-flag">Due soon</span>}
                <span className="money money--expense">{formatMoney(remaining)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="settings-section">
        <h2>Client totals</h2>
        {clients.length === 0 ? (
          <p className="settings-hint">No invoices yet.</p>
        ) : (
          <ul className="settings-list">
            {clients.map((entry) => (
              <li key={entry.client} className="settings-list__item">
                <span>{entry.client}</span>
                <span className="settings-list__meta">
                  Invoiced {formatMoney(entry.invoiced)} · Paid {formatMoney(entry.paid)}
                </span>
                <span className="money money--expense">{formatMoney(entry.remaining)} remaining</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <InvoiceModal open={modalOpen} editing={editingInvoice} onClose={() => setModalOpen(false)} onSave={handleSave} />
      <InvoiceDetail
        open={!!detailInvoice}
        invoice={detailInvoice}
        onClose={() => setDetailInvoice(null)}
        onEdit={openEditFromDetail}
        onAddPayment={handleAddPayment}
        onPrint={(invoice) => {
          setDetailInvoice(null)
          setPrintInvoice(invoice)
        }}
      />
      {printInvoice && <InvoicePrintView invoice={printInvoice} onClose={() => setPrintInvoice(null)} />}
    </div>
  )
}
