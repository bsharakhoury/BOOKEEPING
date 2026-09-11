import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../ui/Modal.jsx'
import { Field } from '../ui/Field.jsx'
import { Card } from '../ui/Card.jsx'
import { Bar } from '../ui/Bar.jsx'
import { Table } from '../ui/Table.jsx'
import { ConfirmInline } from '../ui/ConfirmInline.jsx'
import { useToast } from '../ui/Toast.jsx'
import { usePersistedState } from '../../lib/storage.js'
import { generateId } from '../../lib/id.js'
import { formatMoney } from '../../lib/money.js'
import { formatDate, todayISO } from '../../lib/dates.js'
import { emergencyFundTarget, rentReserveMonthly, requiredMonthlyForGoal } from '../../lib/derive/savings.js'
import { DEFAULT_FX_RATES } from '../../lib/fx.js'

function emptyEntryForm() {
  return { date: todayISO(), amount: '', label: '', notes: '' }
}

function EntryModal({ open, editing, onClose, onSave }) {
  const [form, setForm] = useState(emptyEntryForm)

  useEffect(() => {
    if (!open) return
    setForm(
      editing
        ? { date: editing.date, amount: String(editing.amount ?? ''), label: editing.label || '', notes: editing.notes || '' }
        : emptyEntryForm()
    )
  }, [open, editing])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!form.amount) return
    onSave({ date: form.date, amount: Number(form.amount), label: form.label.trim(), notes: form.notes.trim() })
  }

  return (
    <Modal open={open} title={editing ? 'Edit savings entry' : 'Add savings entry'} onClose={onClose}>
      <form className="settings-form" onSubmit={handleSubmit}>
        <Field label="Date">
          <input type="date" value={form.date} onChange={(event) => updateField('date', event.target.value)} required />
        </Field>
        <Field label="Amount (AED)">
          <input type="number" min="0" step="0.01" value={form.amount} onChange={(event) => updateField('amount', event.target.value)} required />
        </Field>
        <Field label="Label" hint="optional">
          <input value={form.label} onChange={(event) => updateField('label', event.target.value)} />
        </Field>
        <Field label="Notes">
          <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} rows={2} />
        </Field>
        <div className="transaction-form__actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            {editing ? 'Save changes' : 'Add entry'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function emptyGoalForm() {
  return { name: '', target: '', current: '', targetDate: '', notes: '' }
}

function GoalModal({ open, editing, onClose, onSave }) {
  const [form, setForm] = useState(emptyGoalForm)

  useEffect(() => {
    if (!open) return
    setForm(
      editing
        ? {
            name: editing.name || '',
            target: String(editing.target ?? ''),
            current: String(editing.current ?? ''),
            targetDate: editing.targetDate || '',
            notes: editing.notes || ''
          }
        : emptyGoalForm()
    )
  }, [open, editing])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!form.name.trim() || !form.target) return
    onSave({
      name: form.name.trim(),
      target: Number(form.target),
      current: Number(form.current) || 0,
      targetDate: form.targetDate || null,
      notes: form.notes.trim()
    })
  }

  return (
    <Modal open={open} title={editing ? 'Edit goal' : 'Add goal'} onClose={onClose}>
      <form className="settings-form" onSubmit={handleSubmit}>
        <Field label="Name">
          <input value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
        </Field>
        <Field label="Target (AED)">
          <input type="number" min="0" step="0.01" value={form.target} onChange={(event) => updateField('target', event.target.value)} required />
        </Field>
        <Field label="Current (AED)">
          <input type="number" min="0" step="0.01" value={form.current} onChange={(event) => updateField('current', event.target.value)} />
        </Field>
        <Field label="Target date" hint="optional">
          <input type="date" value={form.targetDate} onChange={(event) => updateField('targetDate', event.target.value)} />
        </Field>
        <Field label="Notes">
          <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} rows={2} />
        </Field>
        <div className="transaction-form__actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            {editing ? 'Save changes' : 'Add goal'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function Savings() {
  const [entries, setEntries] = usePersistedState('savingsEntries', [])
  const [goals, setGoals] = usePersistedState('savingsGoals', [])
  const [settings] = usePersistedState('settings', { rent: 12500, rentCycleMonths: 3, fx: DEFAULT_FX_RATES })
  const [transactions] = usePersistedState('transactions', [])
  const showToast = useToast()

  const [entryModalOpen, setEntryModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState(null)
  const [goalModalOpen, setGoalModalOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)

  const totalSaved = useMemo(() => entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0), [entries])
  const rentMonthly = useMemo(() => rentReserveMonthly(settings), [settings])
  const emergencyTarget = useMemo(() => emergencyFundTarget(transactions), [transactions])

  function openAddEntry() {
    setEditingEntry(null)
    setEntryModalOpen(true)
  }

  function openEditEntry(entry) {
    setEditingEntry(entry)
    setEntryModalOpen(true)
  }

  function saveEntry(fields) {
    if (editingEntry) {
      setEntries((prev) => prev.map((entry) => (entry.id === editingEntry.id ? { ...entry, ...fields } : entry)))
    } else {
      setEntries((prev) => [{ id: generateId(), ...fields }, ...prev])
    }
    setEntryModalOpen(false)
  }

  function deleteEntry(entry) {
    setEntries((prev) => prev.filter((e) => e.id !== entry.id))
    showToast(`Deleted savings entry`, { actionLabel: 'Undo', onAction: () => setEntries((prev) => [entry, ...prev]) })
  }

  function openAddGoal() {
    setEditingGoal(null)
    setGoalModalOpen(true)
  }

  function openEditGoal(goal) {
    setEditingGoal(goal)
    setGoalModalOpen(true)
  }

  function saveGoal(fields) {
    if (editingGoal) {
      setGoals((prev) => prev.map((goal) => (goal.id === editingGoal.id ? { ...goal, ...fields } : goal)))
    } else {
      setGoals((prev) => [...prev, { id: generateId(), ...fields }])
    }
    setGoalModalOpen(false)
  }

  function deleteGoal(goal) {
    setGoals((prev) => prev.filter((g) => g.id !== goal.id))
    showToast(`Deleted goal "${goal.name}"`, { actionLabel: 'Undo', onAction: () => setGoals((prev) => [...prev, goal]) })
  }

  const entryColumns = [
    { key: 'date', label: 'Date', render: (entry) => formatDate(entry.date) },
    {
      key: 'label',
      label: 'Label',
      render: (entry) => (
        <button type="button" className="link-button" onClick={() => openEditEntry(entry)}>
          {entry.label || 'Savings'}
        </button>
      )
    },
    { key: 'amount', label: 'Amount', render: (entry) => <span className="money money--income">{formatMoney(entry.amount)}</span> },
    { key: 'actions', label: '', render: (entry) => <ConfirmInline label="Delete" confirmLabel="Confirm" onConfirm={() => deleteEntry(entry)} /> }
  ]

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Savings</h1>
        <span className="money money--income">{formatMoney(totalSaved)} saved</span>
      </div>

      <div className="savings-cards">
        <Card title="Rent reserve">
          <p className="settings-hint">
            Rent is {formatMoney(settings.rent)} every {settings.rentCycleMonths} months.
          </p>
          <span className="money money--expense">{formatMoney(rentMonthly)}</span>
          <span className="settings-list__meta"> / month</span>
        </Card>

        <Card title="Emergency fund">
          <p className="settings-hint">3× the last 3 months' average essential spending.</p>
          <span className="money money--expense">{formatMoney(emergencyTarget)}</span>
          <span className="settings-list__meta"> target</span>
          <Bar value={totalSaved} max={emergencyTarget || 1} />
        </Card>
      </div>

      <section className="settings-section">
        <div className="screen-header">
          <h2>Goals</h2>
          <button type="button" className="primary" onClick={openAddGoal}>
            Add goal
          </button>
        </div>
        {goals.length === 0 ? (
          <p className="settings-hint">No savings goals yet.</p>
        ) : (
          <ul className="settings-list">
            {goals.map((goal) => (
              <li key={goal.id} className="settings-list__item">
                <button type="button" className="link-button" onClick={() => openEditGoal(goal)}>
                  {goal.name}
                </button>
                <span className="settings-list__meta">
                  {formatMoney(goal.current)} of {formatMoney(goal.target)}
                  {goal.targetDate ? ` · by ${formatDate(goal.targetDate)}` : ''} · needs{' '}
                  {formatMoney(requiredMonthlyForGoal(goal))}/mo
                </span>
                <ConfirmInline label="Delete" confirmLabel="Confirm" onConfirm={() => deleteGoal(goal)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="settings-section">
        <div className="screen-header">
          <h2>Entries</h2>
          <button type="button" className="primary" data-shortcut="new" onClick={openAddEntry}>
            Add entry
          </button>
        </div>
        <Table columns={entryColumns} rows={entries} emptyMessage="No savings entries yet." />
      </section>

      <EntryModal open={entryModalOpen} editing={editingEntry} onClose={() => setEntryModalOpen(false)} onSave={saveEntry} />
      <GoalModal open={goalModalOpen} editing={editingGoal} onClose={() => setGoalModalOpen(false)} onSave={saveGoal} />
    </div>
  )
}
