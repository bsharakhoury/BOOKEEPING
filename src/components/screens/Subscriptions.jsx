import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../ui/Modal.jsx'
import { Field } from '../ui/Field.jsx'
import { Card } from '../ui/Card.jsx'
import { Stat } from '../ui/Stat.jsx'
import { CategoryTag } from '../ui/CategoryTag.jsx'
import { ConfirmInline } from '../ui/ConfirmInline.jsx'
import { useToast } from '../ui/Toast.jsx'
import { usePersistedState } from '../../lib/storage.js'
import { generateId } from '../../lib/id.js'
import { formatMoney } from '../../lib/money.js'
import { formatDate, todayISO } from '../../lib/dates.js'
import { annualCost, findPaymentForSubscription, priceChangeFlag, rollForwardDueDates } from '../../lib/derive/subscriptions.js'
import { DEFAULT_CATEGORIES } from '../../data/categories.js'
import { DEFAULT_ACCOUNTS } from '../../data/accounts.js'

const LEDGER_SECTIONS = [
  { id: 'personal', label: 'Personal' },
  { id: 'business', label: 'Business' },
  { id: 'lh_business', label: 'Leaf & Hook' }
]

const FREQUENCY_OPTIONS = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'biannual', label: 'Biannual' },
  { id: 'yearly', label: 'Yearly' }
]

const REMINDER_WINDOW_DAYS = 15

function emptyForm() {
  return {
    name: '',
    ledger: 'personal',
    category: '',
    amount: '',
    frequency: 'monthly',
    dayOfMonth: '',
    nextDue: todayISO(),
    bank: '',
    active: true,
    trialEnds: '',
    notes: ''
  }
}

function SubscriptionModal({ open, editing, categories, accounts, onClose, onSave }) {
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (!open) return
    setForm(
      editing
        ? {
            name: editing.name || '',
            ledger: editing.ledger,
            category: editing.category || '',
            amount: String(editing.amount ?? ''),
            frequency: editing.frequency,
            dayOfMonth: editing.dayOfMonth != null ? String(editing.dayOfMonth) : '',
            nextDue: editing.nextDue || todayISO(),
            bank: editing.bank || '',
            active: editing.active !== false,
            trialEnds: editing.trialEnds || '',
            notes: editing.notes || ''
          }
        : emptyForm()
    )
  }, [open, editing])

  const categoryOptions = useMemo(
    () => categories.filter((category) => !category.archived && category.ledger === form.ledger && category.type === 'expense'),
    [categories, form.ledger]
  )

  function updateField(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'ledger') next.category = ''
      return next
    })
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!form.name.trim() || !form.category || !form.amount || !form.nextDue) return

    onSave({
      name: form.name.trim(),
      ledger: form.ledger,
      category: form.category,
      amount: Number(form.amount),
      frequency: form.frequency,
      dayOfMonth: form.dayOfMonth === '' ? null : Number(form.dayOfMonth),
      nextDue: form.nextDue,
      bank: form.bank || null,
      active: form.active,
      trialEnds: form.trialEnds || null,
      notes: form.notes.trim()
    })
  }

  return (
    <Modal open={open} title={editing ? 'Edit subscription' : 'Add subscription'} onClose={onClose}>
      <form className="settings-form" onSubmit={handleSubmit}>
        <Field label="Name">
          <input value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
        </Field>
        <Field label="Ledger">
          <select value={form.ledger} onChange={(event) => updateField('ledger', event.target.value)}>
            {LEDGER_SECTIONS.map((section) => (
              <option key={section.id} value={section.id}>
                {section.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category">
          <select value={form.category} onChange={(event) => updateField('category', event.target.value)} required>
            <option value="" disabled>
              Select a category
            </option>
            {categoryOptions.map((category) => (
              <option key={category.id} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Amount (AED)">
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(event) => updateField('amount', event.target.value)}
            required
          />
        </Field>
        <Field label="Frequency">
          <select value={form.frequency} onChange={(event) => updateField('frequency', event.target.value)}>
            {FREQUENCY_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Day of month" hint="optional">
          <input
            type="number"
            min="1"
            max="31"
            value={form.dayOfMonth}
            onChange={(event) => updateField('dayOfMonth', event.target.value)}
          />
        </Field>
        <Field label="Next due">
          <input type="date" value={form.nextDue} onChange={(event) => updateField('nextDue', event.target.value)} required />
        </Field>
        <Field label="Account" hint="optional">
          <select value={form.bank} onChange={(event) => updateField('bank', event.target.value)}>
            <option value="">—</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.name}>
                {account.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Trial ends" hint="optional">
          <input type="date" value={form.trialEnds} onChange={(event) => updateField('trialEnds', event.target.value)} />
        </Field>
        <Field label="Active">
          <select value={form.active ? 'yes' : 'no'} onChange={(event) => updateField('active', event.target.value === 'yes')}>
            <option value="yes">Active</option>
            <option value="no">Inactive</option>
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
            {editing ? 'Save changes' : 'Add subscription'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function daysUntil(dateStr, today) {
  return Math.round((new Date(dateStr) - new Date(today)) / 86400000)
}

function DueLabel({ nextDue, today }) {
  const days = daysUntil(nextDue, today)
  if (days < 0) return <span className="due-overdue">Next: {formatDate(nextDue)} (overdue)</span>
  if (days === 0) return <span className="due-soon">Next: {formatDate(nextDue)} (today)</span>
  if (days <= REMINDER_WINDOW_DAYS) return <span className="due-soon">Next: {formatDate(nextDue)} ({days}d)</span>
  return (
    <span className="settings-list__meta">
      Next: {formatDate(nextDue)} ({days}d)
    </span>
  )
}

function SubscriptionRow({ sub, categories, today, onEdit, onToggle, onDelete }) {
  const monthlyEq = sub.frequency === 'monthly' ? null : annualCost(sub) / 12
  return (
    <li className="sub-row">
      <div className="sub-row__info">
        <button type="button" className="link-button sub-row__name" onClick={() => onEdit(sub)}>
          {sub.name}
        </button>
        <div className="sub-row__meta">
          <CategoryTag name={sub.category} categories={categories} />
          <DueLabel nextDue={sub.nextDue} today={today} />
          {sub.priceChanged && <span className="dup-flag">Price changed</span>}
        </div>
      </div>
      <div className="sub-row__actions">
        <div className="sub-row__amount">
          <span className="money money--expense">
            {formatMoney(sub.amount)}/{sub.frequency === 'monthly' ? 'mo' : 'yr'}
          </span>
          {monthlyEq != null && <span className="settings-list__meta">≈{formatMoney(monthlyEq)}/mo</span>}
        </div>
        <button type="button" className={sub.active ? 'sub-toggle sub-toggle--on' : 'sub-toggle'} onClick={() => onToggle(sub)}>
          {sub.active ? 'ON' : 'OFF'}
        </button>
        <button type="button" onClick={() => onEdit(sub)}>
          Edit
        </button>
        <ConfirmInline label="Delete" confirmLabel="Confirm" onConfirm={() => onDelete(sub)} />
      </div>
    </li>
  )
}

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = usePersistedState('subscriptions', [])
  const [categories] = usePersistedState('categories', DEFAULT_CATEGORIES)
  const [accounts] = usePersistedState('accounts', DEFAULT_ACCOUNTS)
  const [transactions] = usePersistedState('transactions', [])
  const showToast = useToast()
  const today = todayISO()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingSub, setEditingSub] = useState(null)

  useEffect(() => {
    const rolled = rollForwardDueDates(subscriptions)
    const changed = rolled.some((sub, index) => sub !== subscriptions[index])
    if (changed) setSubscriptions(rolled)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enriched = useMemo(
    () =>
      subscriptions.map((sub) => {
        const matched = findPaymentForSubscription(sub, transactions)
        return { ...sub, matched, priceChanged: priceChangeFlag(sub, matched) }
      }),
    [subscriptions, transactions]
  )

  const active = useMemo(() => enriched.filter((sub) => sub.active), [enriched])

  const comingUp = useMemo(
    () =>
      active
        .filter((sub) => sub.nextDue && daysUntil(sub.nextDue, today) <= REMINDER_WINDOW_DAYS)
        .sort((a, b) => (a.nextDue < b.nextDue ? -1 : 1)),
    [active, today]
  )

  const monthlyByLedger = useMemo(() => {
    const totals = {}
    LEDGER_SECTIONS.forEach((section) => {
      totals[section.id] = active
        .filter((sub) => sub.ledger === section.id && sub.frequency === 'monthly')
        .reduce((sum, sub) => sum + Number(sub.amount || 0), 0)
    })
    return totals
  }, [active])

  const nonMonthly = useMemo(() => enriched.filter((sub) => sub.frequency !== 'monthly'), [enriched])
  const nonMonthlyMonthlyEquiv = useMemo(
    () => active.filter((sub) => sub.frequency !== 'monthly').reduce((sum, sub) => sum + annualCost(sub) / 12, 0),
    [active]
  )

  const trueMonthlyTotal =
    monthlyByLedger.personal + monthlyByLedger.business + monthlyByLedger.lh_business + nonMonthlyMonthlyEquiv

  const installmentTxns = useMemo(() => transactions.filter((txn) => txn.installment && txn.installment.endMonth), [transactions])

  function openAdd() {
    setEditingSub(null)
    setModalOpen(true)
  }

  function openEdit(sub) {
    setEditingSub(sub)
    setModalOpen(true)
  }

  function handleSave(fields) {
    if (editingSub) {
      setSubscriptions((prev) => prev.map((sub) => (sub.id === editingSub.id ? { ...sub, ...fields } : sub)))
    } else {
      setSubscriptions((prev) => [...prev, { id: generateId(), lastDue: null, paidOn: [], ...fields }])
    }
    setModalOpen(false)
  }

  function toggleActive(sub) {
    setSubscriptions((prev) => prev.map((s) => (s.id === sub.id ? { ...s, active: !s.active } : s)))
  }

  function handleDelete(sub) {
    setSubscriptions((prev) => prev.filter((s) => s.id !== sub.id))
    showToast(`Deleted "${sub.name}"`, {
      actionLabel: 'Undo',
      onAction: () => setSubscriptions((prev) => [...prev, sub])
    })
  }

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Subscriptions</h1>
        <button type="button" className="primary" data-shortcut="new" onClick={openAdd}>
          Add subscription
        </button>
      </div>
      <p className="settings-hint">Fixed recurring charges. Yearly subs show monthly equivalent — not counted in monthly total.</p>

      {comingUp.length > 0 && (
        <div className="reminder-banner">
          <strong>Coming up:</strong>{' '}
          {comingUp
            .map((sub) => `${sub.name} — ${formatMoney(sub.amount)} on ${formatDate(sub.nextDue)} (${daysUntil(sub.nextDue, today)}d)`)
            .join(' · ')}
        </div>
      )}

      <div className="dashboard-cards">
        <Card title="Personal monthly">
          <Stat value={formatMoney(monthlyByLedger.personal)} tone="expense" />
          <span className="settings-hint">active monthly only</span>
        </Card>
        <Card title="Business monthly">
          <Stat value={formatMoney(monthlyByLedger.business)} tone="expense" />
          <span className="settings-hint">active monthly only</span>
        </Card>
        <Card title="Leaf & Hook monthly">
          <Stat value={formatMoney(monthlyByLedger.lh_business)} tone="expense" />
          <span className="settings-hint">active monthly only</span>
        </Card>
        <Card title="Non-monthly — monthly eq.">
          <Stat value={formatMoney(nonMonthlyMonthlyEquiv)} tone="expense" />
          <span className="settings-hint">not a real monthly cost</span>
        </Card>
        <Card title="True monthly total">
          <Stat value={formatMoney(trueMonthlyTotal)} tone="expense" />
          <span className="settings-hint">incl. yearly spread</span>
        </Card>
      </div>

      {nonMonthly.length > 0 && (
        <section className="settings-section">
          <h2>Non-monthly</h2>
          <p className="settings-hint">Paid in full, shown as monthly equivalent. Not added to your monthly total.</p>
          <ul className="settings-list">
            {nonMonthly.map((sub) => (
              <SubscriptionRow
                key={sub.id}
                sub={sub}
                categories={categories}
                today={today}
                onEdit={openEdit}
                onToggle={toggleActive}
                onDelete={handleDelete}
              />
            ))}
          </ul>
        </section>
      )}

      {LEDGER_SECTIONS.map((section) => {
        const rows = enriched.filter((sub) => sub.ledger === section.id && sub.frequency === 'monthly')
        if (rows.length === 0) return null
        return (
          <section className="settings-section" key={section.id}>
            <h2>{section.label} — monthly</h2>
            <ul className="settings-list">
              {rows.map((sub) => (
                <SubscriptionRow
                  key={sub.id}
                  sub={sub}
                  categories={categories}
                  today={today}
                  onEdit={openEdit}
                  onToggle={toggleActive}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          </section>
        )
      })}

      {enriched.length === 0 && <div className="table-empty">No subscriptions yet.</div>}

      <section className="settings-section">
        <h2>Installments</h2>
        {installmentTxns.length === 0 ? (
          <p className="settings-hint">No transactions are tagged with an installment plan yet.</p>
        ) : (
          <ul className="settings-list">
            {installmentTxns.map((txn) => (
              <li key={txn.id} className="settings-list__item">
                <span>{txn.merchant}</span>
                <span className="settings-list__meta">
                  {formatMoney(txn.amount)} · {txn.installment.remaining ?? '?'} of plan remaining · ends {txn.installment.endMonth}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <SubscriptionModal
        open={modalOpen}
        editing={editingSub}
        categories={categories}
        accounts={accounts}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  )
}
