import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../ui/Modal.jsx'
import { Field } from '../ui/Field.jsx'
import { Card } from '../ui/Card.jsx'
import { Chip } from '../ui/Chip.jsx'
import { ConfirmInline } from '../ui/ConfirmInline.jsx'
import { useToast } from '../ui/Toast.jsx'
import { usePersistedState } from '../../lib/storage.js'
import { generateId } from '../../lib/id.js'
import { formatMoney } from '../../lib/money.js'
import { formatDate, todayISO } from '../../lib/dates.js'
import { multiDebtProjection, payoffProjection } from '../../lib/derive/debt.js'
import { DEFAULT_ACCOUNTS } from '../../data/accounts.js'

const SCOPE_OPTIONS = ['Personal', 'Business']

function round2(value) {
  return Math.round(value * 100) / 100
}

function emptyDebtForm() {
  return { name: '', type: '', scope: 'Personal', lender: '', original: '', remaining: '', interest: '0', monthlyMin: '', notes: '' }
}

function DebtModal({ open, editing, onClose, onSave }) {
  const [form, setForm] = useState(emptyDebtForm)

  useEffect(() => {
    if (!open) return
    setForm(
      editing
        ? {
            name: editing.name || '',
            type: editing.type || '',
            scope: editing.scope || 'Personal',
            lender: editing.lender || '',
            original: String(editing.original ?? ''),
            remaining: String(editing.remaining ?? ''),
            interest: String(editing.interest ?? '0'),
            monthlyMin: String(editing.monthlyMin ?? ''),
            notes: editing.notes || ''
          }
        : emptyDebtForm()
    )
  }, [open, editing])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!form.name.trim() || form.original === '' || form.remaining === '') return
    onSave({
      name: form.name.trim(),
      type: form.type.trim(),
      scope: form.scope,
      lender: form.lender.trim(),
      original: Number(form.original),
      remaining: Number(form.remaining),
      interest: Number(form.interest) || 0,
      monthlyMin: Number(form.monthlyMin) || 0,
      notes: form.notes.trim()
    })
  }

  return (
    <Modal open={open} title={editing ? 'Edit debt' : 'Add debt'} onClose={onClose}>
      <form className="settings-form" onSubmit={handleSubmit}>
        <Field label="Name">
          <input value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
        </Field>
        <Field label="Type" hint="e.g. Credit card, Personal loan">
          <input value={form.type} onChange={(event) => updateField('type', event.target.value)} />
        </Field>
        <Field label="Scope">
          <select value={form.scope} onChange={(event) => updateField('scope', event.target.value)}>
            {SCOPE_OPTIONS.map((scope) => (
              <option key={scope} value={scope}>
                {scope}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Lender">
          <input value={form.lender} onChange={(event) => updateField('lender', event.target.value)} />
        </Field>
        <Field label="Original amount (AED)">
          <input type="number" min="0" step="0.01" value={form.original} onChange={(event) => updateField('original', event.target.value)} required />
        </Field>
        <Field label="Remaining balance (AED)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.remaining}
            onChange={(event) => updateField('remaining', event.target.value)}
            required
          />
        </Field>
        <Field label="Interest rate" hint="annual %, optional">
          <input type="number" min="0" step="0.01" value={form.interest} onChange={(event) => updateField('interest', event.target.value)} />
        </Field>
        <Field label="Monthly minimum (AED)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.monthlyMin}
            onChange={(event) => updateField('monthlyMin', event.target.value)}
          />
        </Field>
        <Field label="Notes">
          <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} rows={2} />
        </Field>
        <div className="transaction-form__actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            {editing ? 'Save changes' : 'Add debt'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function emptyPaymentForm(remaining) {
  return { date: todayISO(), amount: String(remaining ?? ''), isSettlement: false, paymentMethod: '', notes: '' }
}

function PaymentModal({ open, debt, accounts, onClose, onSave }) {
  const [form, setForm] = useState(() => emptyPaymentForm())

  useEffect(() => {
    if (!open || !debt) return
    setForm(emptyPaymentForm(debt.remaining))
  }, [open, debt])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!form.amount || !form.paymentMethod) return
    onSave({
      date: form.date,
      amount: Number(form.amount),
      isSettlement: form.isSettlement,
      paymentMethod: form.paymentMethod,
      notes: form.notes.trim()
    })
  }

  if (!debt) return null

  return (
    <Modal open={open} title={`Add payment — ${debt.name}`} onClose={onClose}>
      <form className="settings-form" onSubmit={handleSubmit}>
        <Field label="Date">
          <input type="date" value={form.date} onChange={(event) => updateField('date', event.target.value)} required />
        </Field>
        <Field label="Amount (AED)">
          <input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => updateField('amount', event.target.value)} required />
        </Field>
        <Field label="Account">
          <select value={form.paymentMethod} onChange={(event) => updateField('paymentMethod', event.target.value)} required>
            <option value="" disabled>
              Select an account
            </option>
            {accounts.map((account) => (
              <option key={account.id} value={account.name}>
                {account.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="This is a settlement" hint="pays off the remaining balance for less than owed">
          <select
            value={form.isSettlement ? 'yes' : 'no'}
            onChange={(event) => updateField('isSettlement', event.target.value === 'yes')}
          >
            <option value="no">No — regular payment</option>
            <option value="yes">Yes — settlement</option>
          </select>
        </Field>
        <Field label="Notes">
          <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} rows={2} />
        </Field>
        <div className="transaction-form__actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Record payment
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Debt() {
  const [debts, setDebts] = usePersistedState('debts', [])
  const [transactions, setTransactions] = usePersistedState('transactions', [])
  const [accounts] = usePersistedState('accounts', DEFAULT_ACCOUNTS)
  const showToast = useToast()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingDebt, setEditingDebt] = useState(null)
  const [paymentDebt, setPaymentDebt] = useState(null)
  const [strategy, setStrategy] = useState('avalanche')
  const [extraMonthly, setExtraMonthly] = useState(0)

  const activeDebts = useMemo(() => debts.filter((debt) => debt.status !== 'settled'), [debts])
  const settledDebts = useMemo(() => debts.filter((debt) => debt.status === 'settled'), [debts])

  const projection = useMemo(
    () => multiDebtProjection(activeDebts, { extraMonthly: Number(extraMonthly) || 0, strategy }),
    [activeDebts, extraMonthly, strategy]
  )

  function openAdd() {
    setEditingDebt(null)
    setModalOpen(true)
  }

  function openEdit(debt) {
    setEditingDebt(debt)
    setModalOpen(true)
  }

  function handleSave(fields) {
    if (editingDebt) {
      setDebts((prev) => prev.map((debt) => (debt.id === editingDebt.id ? { ...debt, ...fields } : debt)))
    } else {
      setDebts((prev) => [...prev, { id: generateId(), payments: [], status: 'active', ...fields }])
    }
    setModalOpen(false)
  }

  function handleDelete(debt) {
    setDebts((prev) => prev.filter((d) => d.id !== debt.id))
    showToast(`Deleted "${debt.name}"`, {
      actionLabel: 'Undo',
      onAction: () => setDebts((prev) => [...prev, debt])
    })
  }

  function handleAddPayment(fields) {
    const debt = paymentDebt
    const now = new Date().toISOString()
    const newRemaining = fields.isSettlement ? 0 : Math.max(0, round2(debt.remaining - fields.amount))
    const savedAmount = fields.isSettlement ? round2(Math.max(0, debt.remaining - fields.amount)) : null
    const nextStatus = newRemaining <= 0 ? 'settled' : debt.status

    const txn = {
      id: generateId(),
      date: fields.date,
      merchant: `Debt payment — ${debt.name}`,
      rawMerchant: `Debt payment — ${debt.name}`,
      category: 'Debt payment',
      ledger: debt.scope === 'Business' ? 'business' : 'personal',
      amount: fields.amount,
      type: 'expense',
      paymentMethod: fields.paymentMethod,
      currency: 'AED',
      fxRate: 1,
      fxAmount: fields.amount,
      bankRef: null,
      notes: fields.notes,
      source: 'manual',
      tags: [],
      linkedInvoiceId: null,
      linkedDebtId: debt.id,
      linkedSubId: null,
      inputVat: null,
      reclaimable: false,
      docType: null,
      installment: null,
      importBatchId: null,
      createdAt: now,
      updatedAt: now
    }

    const payment = {
      date: fields.date,
      amount: fields.amount,
      txnId: txn.id,
      isSettlement: fields.isSettlement,
      savedAmount
    }

    setTransactions((prev) => [txn, ...prev])
    setDebts((prev) =>
      prev.map((d) => (d.id === debt.id ? { ...d, remaining: newRemaining, status: nextStatus, payments: [...d.payments, payment] } : d))
    )
    setPaymentDebt(null)

    showToast(`Recorded ${formatMoney(fields.amount)} payment on "${debt.name}"`, {
      actionLabel: 'Undo',
      onAction: () => {
        setTransactions((prev) => prev.filter((t) => t.id !== txn.id))
        setDebts((prev) =>
          prev.map((d) =>
            d.id === debt.id
              ? { ...d, remaining: debt.remaining, status: debt.status, payments: d.payments.filter((p) => p.txnId !== txn.id) }
              : d
          )
        )
      }
    })
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Debt</h1>
        <button type="button" className="primary" data-shortcut="new" onClick={openAdd}>
          Add debt
        </button>
      </div>

      {activeDebts.length === 0 ? (
        <p className="settings-hint">No active debts.</p>
      ) : (
        <ul className="settings-list">
          {activeDebts.map((debt) => {
            const debtProjection = payoffProjection(debt)
            return (
              <li key={debt.id} className="debt-row">
                <div className="debt-row__header">
                  <button type="button" className="link-button" onClick={() => openEdit(debt)}>
                    {debt.name}
                  </button>
                  <span className="settings-list__meta">
                    {debt.type} · {debt.scope} · {debt.lender}
                  </span>
                </div>
                <div className="debt-row__stats">
                  <span className="money money--expense">{formatMoney(debt.remaining)}</span>
                  <span className="settings-list__meta"> of {formatMoney(debt.original)} · min {formatMoney(debt.monthlyMin)}/mo</span>
                  {debt.interest > 0 && <span className="settings-list__meta"> · {debt.interest}% APR</span>}
                </div>
                <div className="settings-list__meta">
                  {debtProjection.payable
                    ? `Payoff in ${debtProjection.months} month${debtProjection.months === 1 ? '' : 's'} (${formatDate(debtProjection.payoffDate)}), ${formatMoney(debtProjection.totalInterest)} interest`
                    : debt.monthlyMin > 0
                      ? 'Minimum payment does not cover interest — will never pay off at this rate'
                      : 'No monthly minimum set — add one, or record payments directly, to project a payoff date'}
                </div>
                <div className="debt-row__actions">
                  <button type="button" onClick={() => setPaymentDebt(debt)}>
                    Add payment
                  </button>
                  <ConfirmInline label="Delete" confirmLabel="Confirm" onConfirm={() => handleDelete(debt)} />
                </div>
                {debt.payments.length > 0 && (
                  <ul className="debt-payments">
                    {[...debt.payments]
                      .sort((a, b) => (a.date < b.date ? 1 : -1))
                      .map((payment, index) => (
                        <li key={`${debt.id}-${index}`}>
                          {formatDate(payment.date)} · {formatMoney(payment.amount)}
                          {payment.isSettlement ? ` · settlement, saved ${formatMoney(payment.savedAmount)}` : ''}
                        </li>
                      ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {settledDebts.length > 0 && (
        <section className="settings-section">
          <h2>Settled</h2>
          <ul className="settings-list">
            {settledDebts.map((debt) => (
              <li key={debt.id} className="settings-list__item">
                <span>{debt.name}</span>
                <span className="settings-list__meta">Settled · original {formatMoney(debt.original)}</span>
                <ConfirmInline label="Delete" confirmLabel="Confirm" onConfirm={() => handleDelete(debt)} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {activeDebts.length > 1 && (
        <Card title="Payoff strategy" className="debt-strategy">
          <div className="chip-row">
            <Chip label="Avalanche (highest interest first)" active={strategy === 'avalanche'} onClick={() => setStrategy('avalanche')} />
            <Chip label="Snowball (smallest balance first)" active={strategy === 'snowball'} onClick={() => setStrategy('snowball')} />
          </div>
          <Field label={`Extra monthly payment: ${formatMoney(extraMonthly)}`}>
            <input
              type="range"
              min="0"
              max="5000"
              step="50"
              value={extraMonthly}
              onChange={(event) => setExtraMonthly(Number(event.target.value))}
            />
          </Field>
          <p className="settings-hint">
            Debt-free in {projection.months} month{projection.months === 1 ? '' : 's'} ({formatDate(projection.payoffDate)}), paying{' '}
            {formatMoney(projection.totalInterest)} total interest.
          </p>
          <ol className="debt-order">
            {projection.order.map((entry) => (
              <li key={entry.id}>
                {entry.name} — paid off month {entry.payoffMonth}
              </li>
            ))}
          </ol>
        </Card>
      )}

      <DebtModal open={modalOpen} editing={editingDebt} onClose={() => setModalOpen(false)} onSave={handleSave} />
      <PaymentModal open={!!paymentDebt} debt={paymentDebt} accounts={accounts} onClose={() => setPaymentDebt(null)} onSave={handleAddPayment} />
    </div>
  )
}
