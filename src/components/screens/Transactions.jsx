import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../ui/Modal.jsx'
import { Field } from '../ui/Field.jsx'
import { Table } from '../ui/Table.jsx'
import { Chip } from '../ui/Chip.jsx'
import { CategoryTag } from '../ui/CategoryTag.jsx'
import { ConfirmInline } from '../ui/ConfirmInline.jsx'
import { useToast } from '../ui/Toast.jsx'
import { ImportBox } from '../import/ImportBox.jsx'
import { ImportPreview } from '../import/ImportPreview.jsx'
import { usePersistedState, getItem, setItem } from '../../lib/storage.js'
import { generateId } from '../../lib/id.js'
import { formatMoney, parseMoney } from '../../lib/money.js'
import { formatDate, monthKey, monthLabel, todayISO } from '../../lib/dates.js'
import { filterTransactions } from '../../lib/transactionSearch.js'
import { DEFAULT_CATEGORIES } from '../../data/categories.js'
import { DEFAULT_ACCOUNTS } from '../../data/accounts.js'
import { DEFAULT_FX_RATES } from '../../lib/fx.js'

const CSV_PARSER_IDS = new Set(['rakCsv', 'stripeCsv'])
function sourceForParser(parserId) {
  return CSV_PARSER_IDS.has(parserId) ? 'csv' : 'sms'
}

const LEDGER_CHIPS = [
  { id: 'all', label: 'All' },
  { id: 'personal', label: 'Personal' },
  { id: 'business', label: 'Mashreq business' },
  { id: 'lh_business', label: 'L&H' },
  { id: 'income', label: 'Income' },
  { id: 'transfers', label: 'Transfers' }
]

const LEDGER_LABELS = {
  personal: 'Personal',
  business: 'Mashreq business',
  lh_business: 'Leaf & Hook',
  income: 'Income'
}

const TYPE_OPTIONS = [
  { id: 'expense', label: 'Expense' },
  { id: 'income', label: 'Income' },
  { id: 'transfer', label: 'Transfer' },
  { id: 'refund', label: 'Refund' }
]

const LEDGER_OPTIONS_BY_TYPE = {
  income: [{ id: 'income', label: 'Income' }],
  expense: [
    { id: 'personal', label: 'Personal' },
    { id: 'business', label: 'Mashreq business' },
    { id: 'lh_business', label: 'Leaf & Hook' }
  ],
  refund: [
    { id: 'personal', label: 'Personal' },
    { id: 'business', label: 'Mashreq business' },
    { id: 'lh_business', label: 'Leaf & Hook' }
  ],
  transfer: [
    { id: 'personal', label: 'Personal' },
    { id: 'business', label: 'Mashreq business' },
    { id: 'lh_business', label: 'Leaf & Hook' }
  ]
}

function toneForType(type) {
  if (type === 'income') return 'income'
  if (type === 'transfer') return 'transfer'
  if (type === 'refund') return 'refund'
  return 'expense'
}

function categoryOptionsFor(categories, ledger, type) {
  if (type === 'transfer') return []
  const categoryType = type === 'refund' ? 'expense' : type
  return categories.filter((c) => !c.archived && c.ledger === ledger && c.type === categoryType)
}

function emptyForm() {
  return {
    date: todayISO(),
    type: 'expense',
    ledger: 'personal',
    category: '',
    merchant: '',
    amount: '',
    paymentMethod: '',
    notes: '',
    tagsInput: ''
  }
}

function TransactionModal({ open, editing, categories, accounts, onClose, onSave }) {
  const [form, setForm] = useState(emptyForm)

  useEffect(() => {
    if (!open) return
    if (editing) {
      setForm({
        date: editing.date,
        type: editing.type,
        ledger: editing.ledger,
        category: editing.category || '',
        merchant: editing.merchant || '',
        amount: String(editing.amount ?? ''),
        paymentMethod: editing.paymentMethod || '',
        notes: editing.notes || '',
        tagsInput: (editing.tags || []).join(', ')
      })
    } else {
      setForm(emptyForm())
    }
  }, [open, editing])

  const ledgerOptions = LEDGER_OPTIONS_BY_TYPE[form.type] ?? []
  const categoryOptions = categoryOptionsFor(categories, form.ledger, form.type)

  function updateField(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === 'type') {
        const allowed = LEDGER_OPTIONS_BY_TYPE[value] ?? []
        if (!allowed.some((option) => option.id === next.ledger)) next.ledger = allowed[0]?.id ?? ''
        next.category = ''
      }
      if (field === 'ledger') next.category = ''
      return next
    })
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!form.merchant.trim() || !form.paymentMethod || !form.amount) return
    if (form.type !== 'transfer' && !form.category) return

    const tags = form.tagsInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

    onSave({
      date: form.date,
      type: form.type,
      ledger: form.ledger,
      category: form.type === 'transfer' ? 'Transfer' : form.category,
      merchant: form.merchant.trim(),
      amount: parseMoney(form.amount),
      paymentMethod: form.paymentMethod,
      notes: form.notes.trim(),
      tags
    })
  }

  return (
    <Modal open={open} title={editing ? 'Edit transaction' : 'Add transaction'} onClose={onClose}>
      <form className="transaction-form" onSubmit={handleSubmit}>
        <Field label="Date">
          <input type="date" value={form.date} onChange={(event) => updateField('date', event.target.value)} required />
        </Field>

        <Field label="Type">
          <select value={form.type} onChange={(event) => updateField('type', event.target.value)}>
            {TYPE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Ledger">
          <select value={form.ledger} onChange={(event) => updateField('ledger', event.target.value)}>
            {ledgerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        {form.type !== 'transfer' && (
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
        )}

        <Field label="Merchant / description">
          <input value={form.merchant} onChange={(event) => updateField('merchant', event.target.value)} required />
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

        <Field label="Tags" hint="comma separated">
          <input value={form.tagsInput} onChange={(event) => updateField('tagsInput', event.target.value)} />
        </Field>

        <Field label="Notes">
          <textarea value={form.notes} onChange={(event) => updateField('notes', event.target.value)} rows={2} />
        </Field>

        <div className="transaction-form__actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            {editing ? 'Save changes' : 'Add transaction'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function ImportModal({ open, categories, accounts, transactions, merchantRules, fxRates, onClose, onCommit }) {
  const [parsed, setParsed] = useState(null) // { rawRows, meta }

  function handleClose() {
    setParsed(null)
    onClose()
  }

  return (
    <Modal open={open} title="Import transactions" onClose={handleClose}>
      {!parsed ? (
        <ImportBox fxRates={fxRates} onParsed={(rawRows, meta) => setParsed({ rawRows, meta })} />
      ) : (
        <ImportPreview
          rawRows={parsed.rawRows}
          meta={parsed.meta}
          categories={categories}
          accounts={accounts}
          merchantRules={merchantRules}
          existingTransactions={transactions}
          onCancel={() => setParsed(null)}
          onCommit={(rows) => {
            onCommit(rows, parsed.meta)
            setParsed(null)
          }}
        />
      )}
    </Modal>
  )
}

export default function Transactions() {
  const [transactions, setTransactions] = usePersistedState('transactions', [])
  const [categories] = usePersistedState('categories', DEFAULT_CATEGORIES)
  const [accounts] = usePersistedState('accounts', DEFAULT_ACCOUNTS)
  const [merchantRules] = usePersistedState('merchantRules', [])
  const [settings] = usePersistedState('settings', { fx: DEFAULT_FX_RATES })
  const showToast = useToast()

  const [ledgerFilter, setLedgerFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTxn, setEditingTxn] = useState(null)
  const [importModalOpen, setImportModalOpen] = useState(false)

  const months = useMemo(() => {
    const set = new Set(transactions.map((txn) => monthKey(txn.date)))
    return Array.from(set).sort().reverse()
  }, [transactions])

  const activeCategories = useMemo(() => categories.filter((category) => !category.archived), [categories])

  const filtered = useMemo(() => {
    const rows = filterTransactions(transactions, {
      ledger: ledgerFilter,
      month: monthFilter,
      category: categoryFilter,
      query
    })
    return [...rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [transactions, ledgerFilter, monthFilter, categoryFilter, query])

  function openAddModal() {
    setEditingTxn(null)
    setModalOpen(true)
  }

  function openEditModal(txn) {
    setEditingTxn(txn)
    setModalOpen(true)
  }

  function handleSave(fields) {
    const now = new Date().toISOString()

    if (editingTxn) {
      setTransactions((prev) => prev.map((txn) => (txn.id === editingTxn.id ? { ...txn, ...fields, updatedAt: now } : txn)))
    } else {
      const newTxn = {
        id: generateId(),
        rawMerchant: fields.merchant,
        currency: 'AED',
        fxRate: 1,
        fxAmount: fields.amount,
        bankRef: null,
        source: 'manual',
        linkedInvoiceId: null,
        linkedDebtId: null,
        linkedSubId: null,
        inputVat: null,
        reclaimable: false,
        docType: null,
        installment: null,
        importBatchId: null,
        createdAt: now,
        updatedAt: now,
        ...fields
      }
      setTransactions((prev) => [newTxn, ...prev])
    }
    setModalOpen(false)
  }

  function handleDelete(id) {
    const removed = transactions.find((txn) => txn.id === id)
    if (!removed) return
    setTransactions((prev) => prev.filter((txn) => txn.id !== id))
    showToast(`Deleted "${removed.merchant}"`, {
      actionLabel: 'Undo',
      onAction: () => setTransactions((prev) => [removed, ...prev])
    })
  }

  function handleImportCommit(rows, meta) {
    const now = new Date().toISOString()
    const batchId = generateId()
    const source = sourceForParser(meta.parserId)

    const newTxns = rows.map((row) => ({
      id: generateId(),
      date: row.date,
      merchant: row.merchant,
      rawMerchant: row.rawMerchant,
      category: row.category,
      ledger: row.ledger,
      amount: row.amount,
      type: row.type,
      paymentMethod: row.paymentMethod,
      currency: row.currency || 'AED',
      fxRate: row.fxRate ?? 1,
      fxAmount: row.fxAmount ?? row.amount,
      bankRef: row.bankRef || null,
      notes: row.notes || '',
      source,
      tags: [],
      linkedInvoiceId: null,
      linkedDebtId: null,
      linkedSubId: null,
      inputVat: row.inputVat ?? null,
      reclaimable: row.reclaimable ?? false,
      docType: null,
      installment: null,
      importBatchId: batchId,
      createdAt: now,
      updatedAt: now
    }))

    setTransactions((prev) => [...newTxns, ...prev])

    const rememberRows = rows.filter((row) => row.rememberMerchant)
    if (rememberRows.length > 0) {
      const existingRules = getItem('merchantRules', [])
      const newRules = rememberRows.map((row) => ({
        match: row.rawMerchant,
        merchant: row.merchant,
        category: row.category,
        ledger: row.ledger
      }))
      setItem('merchantRules', [...existingRules, ...newRules])
    }

    setItem('importBatches', [
      ...getItem('importBatches', []),
      { id: batchId, createdAt: now, source: meta.parserId, label: meta.label, sourceName: meta.sourceName, count: newTxns.length }
    ])

    setImportModalOpen(false)
    showToast(`Imported ${newTxns.length} transaction${newTxns.length === 1 ? '' : 's'} from ${meta.label}`, {
      actionLabel: 'Undo',
      onAction: () => {
        setTransactions((prev) => prev.filter((txn) => txn.importBatchId !== batchId))
        setItem('importBatches', getItem('importBatches', []).filter((batch) => batch.id !== batchId))
      }
    })
  }

  const columns = [
    { key: 'date', label: 'Date', render: (txn) => formatDate(txn.date) },
    {
      key: 'merchant',
      label: 'Merchant',
      render: (txn) => (
        <button type="button" className="link-button" onClick={() => openEditModal(txn)}>
          {txn.merchant}
        </button>
      )
    },
    { key: 'category', label: 'Category', render: (txn) => <CategoryTag name={txn.category} categories={categories} /> },
    { key: 'ledger', label: 'Ledger', render: (txn) => LEDGER_LABELS[txn.ledger] ?? txn.ledger },
    { key: 'paymentMethod', label: 'Account' },
    {
      key: 'amount',
      label: 'Amount',
      render: (txn) => <span className={`money money--${toneForType(txn.type)}`}>{formatMoney(txn.amount)}</span>
    },
    {
      key: 'actions',
      label: '',
      render: (txn) => <ConfirmInline label="Delete" confirmLabel="Confirm" onConfirm={() => handleDelete(txn.id)} />
    }
  ]

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Transactions</h1>
        <div className="screen-header__actions">
          <button type="button" onClick={() => setImportModalOpen(true)}>
            Import
          </button>
          <button type="button" className="primary" data-shortcut="new" onClick={openAddModal}>
            Add transaction
          </button>
        </div>
      </div>

      <div className="chip-row">
        {LEDGER_CHIPS.map((chip) => (
          <Chip key={chip.id} label={chip.label} active={ledgerFilter === chip.id} onClick={() => setLedgerFilter(chip.id)} />
        ))}
      </div>

      <div className="chip-row">
        <Chip label="All months" active={monthFilter === 'all'} onClick={() => setMonthFilter('all')} />
        {months.map((month) => (
          <Chip key={month} label={monthLabel(month)} active={monthFilter === month} onClick={() => setMonthFilter(month)} />
        ))}
      </div>

      <div className="filters-row">
        <input
          className="search-input"
          type="search"
          data-shortcut="search"
          placeholder="Search merchant, notes — try cat: acct: tag: >amount"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
          <option value="all">All categories</option>
          {activeCategories.map((category) => (
            <option key={category.id} value={category.name}>
              {category.name}
            </option>
          ))}
        </select>
      </div>

      <Table columns={columns} rows={filtered} emptyMessage="No transactions match these filters yet." />

      <TransactionModal
        open={modalOpen}
        editing={editingTxn}
        categories={categories}
        accounts={accounts}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />

      <ImportModal
        open={importModalOpen}
        categories={categories}
        accounts={accounts}
        transactions={transactions}
        merchantRules={merchantRules}
        fxRates={settings.fx || DEFAULT_FX_RATES}
        onClose={() => setImportModalOpen(false)}
        onCommit={handleImportCommit}
      />
    </div>
  )
}
