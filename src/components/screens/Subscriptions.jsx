import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../ui/Modal.jsx'
import { Field } from '../ui/Field.jsx'
import { Table } from '../ui/Table.jsx'
import { Chip } from '../ui/Chip.jsx'
import { ConfirmInline } from '../ui/ConfirmInline.jsx'
import { Card } from '../ui/Card.jsx'
import { useToast } from '../ui/Toast.jsx'
import { usePersistedState } from '../../lib/storage.js'
import { generateId } from '../../lib/id.js'
import { formatMoney } from '../../lib/money.js'
import { formatDate, todayISO } from '../../lib/dates.js'
import { annualCost, findPaymentForSubscription, priceChangeFlag, rollForwardDueDates } from '../../lib/derive/subscriptions.js'
import { DEFAULT_CATEGORIES } from '../../data/categories.js'
import { DEFAULT_ACCOUNTS } from '../../data/accounts.js'

const LEDGER_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'personal', label: 'Personal' },
  { id: 'business', label: 'Mashreq business' },
  { id: 'lh_business', label: 'Leaf & Hook' }
]

const LEDGER_LABELS = { personal: 'Personal', business: 'Mashreq business', lh_business: 'Leaf & Hook' }

const FREQUENCY_OPTIONS = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'quarterly', label: 'Quarterly' },
  { id: 'biannual', label: 'Biannual' },
  { id: 'yearly', label: 'Yearly' }
]

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
            {LEDGER_CHIPS.filter((chip) => chip.id !== 'all').map((chip) => (
              <option key={chip.id} value={chip.id}>
                {chip.label}
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

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = usePersistedState('subscriptions', [])
  const [categories] = usePersistedState('categories', DEFAULT_CATEGORIES)
  const [accounts] = usePersistedState('accounts', DEFAULT_ACCOUNTS)
  const [transactions] = usePersistedState('transactions', [])
  const showToast = useToast()

  const [ledgerFilter, setLedgerFilter] = useState('all')
  const [showAnnual, setShowAnnual] = useState(false)
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

  const filtered = useMemo(
    () => (ledgerFilter === 'all' ? enriched : enriched.filter((sub) => sub.ledger === ledgerFilter)),
    [enriched, ledgerFilter]
  )

  const annualTotal = useMemo(() => filtered.filter((sub) => sub.active).reduce((sum, sub) => sum + annualCost(sub), 0), [filtered])

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

  const columns = [
    {
      key: 'name',
      label: 'Name',
      render: (sub) => (
        <button type="button" className="link-button" onClick={() => openEdit(sub)}>
          {sub.name}
        </button>
      )
    },
    { key: 'category', label: 'Category' },
    { key: 'ledger', label: 'Ledger', render: (sub) => LEDGER_LABELS[sub.ledger] ?? sub.ledger },
    {
      key: 'amount',
      label: showAnnual ? 'Annual cost' : 'Amount',
      render: (sub) => (
        <span className="money money--expense">{formatMoney(showAnnual ? annualCost(sub) : sub.amount)}</span>
      )
    },
    { key: 'frequency', label: 'Frequency', render: (sub) => FREQUENCY_OPTIONS.find((f) => f.id === sub.frequency)?.label ?? sub.frequency },
    {
      key: 'due',
      label: 'Due',
      render: (sub) =>
        sub.matched ? (
          <span className="money money--income">Paid ✓ {formatDate(sub.matched.date)}</span>
        ) : (
          formatDate(sub.nextDue)
        )
    },
    {
      key: 'price',
      label: '',
      render: (sub) => (sub.priceChanged ? <span className="dup-flag">Price changed</span> : null)
    },
    {
      key: 'active',
      label: 'Status',
      render: (sub) => (
        <button type="button" className="link-button" onClick={() => toggleActive(sub)}>
          {sub.active ? 'Active' : 'Inactive'}
        </button>
      )
    },
    {
      key: 'actions',
      label: '',
      render: (sub) => <ConfirmInline label="Delete" confirmLabel="Confirm" onConfirm={() => handleDelete(sub)} />
    }
  ]

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Subscriptions</h1>
        <button type="button" className="primary" data-shortcut="new" onClick={openAdd}>
          Add subscription
        </button>
      </div>

      <div className="chip-row">
        {LEDGER_CHIPS.map((chip) => (
          <Chip key={chip.id} label={chip.label} active={ledgerFilter === chip.id} onClick={() => setLedgerFilter(chip.id)} />
        ))}
      </div>

      <Card className="subscriptions-summary">
        <div className="screen-header">
          <span>
            {showAnnual ? 'Annual cost' : 'Active subscriptions'} total:{' '}
            <span className="money money--expense">{formatMoney(annualTotal)}</span>
            {showAnnual ? '' : ' / year'}
          </span>
          <button type="button" onClick={() => setShowAnnual((prev) => !prev)}>
            {showAnnual ? 'Show periodic amounts' : 'Show annual cost'}
          </button>
        </div>
      </Card>

      <Table columns={columns} rows={filtered} emptyMessage="No subscriptions yet." />

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
