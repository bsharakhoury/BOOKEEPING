import { useEffect, useRef, useState } from 'react'
import packageJson from '../../../package.json'
import { SCHEMA_VERSION } from '../../lib/migrations.js'
import { clearAll, exportAll, getItem, restoreSnapshot, setItem } from '../../lib/storage.js'
import { generateId } from '../../lib/id.js'
import { formatDate } from '../../lib/dates.js'
import { useRemountApp } from '../../lib/remountContext.js'
import { applyTheme, THEME_OPTIONS } from '../../theme.js'
import { Modal } from '../ui/Modal.jsx'
import { Field } from '../ui/Field.jsx'
import { ConfirmInline } from '../ui/ConfirmInline.jsx'
import { useToast } from '../ui/Toast.jsx'
import { DEFAULT_CATEGORIES } from '../../data/categories.js'
import { DEFAULT_ACCOUNTS } from '../../data/accounts.js'
import { mapLegacyBackup, mergeById, mergeVatAdjustments, parseLegacyBackup } from '../../lib/legacyImport.js'
import { pushTransactionsToSheet, requestAccessToken } from '../../lib/googleSheetsSync.js'

const LEDGER_CHOICES = [
  { id: 'personal', label: 'Personal' },
  { id: 'business', label: 'Mashreq business' },
  { id: 'lh_business', label: 'Leaf & Hook' },
  { id: 'income', label: 'Income' }
]

const TYPE_CHOICES = [
  { id: 'expense', label: 'Expense' },
  { id: 'income', label: 'Income' }
]

const STREAM_CHOICES = [
  { id: '', label: 'None' },
  { id: 'salary', label: 'Salary' },
  { id: 'lh_media', label: 'L&H Media' },
  { id: 'lh_wellness', label: 'L&H Wellness' },
  { id: 'freelance', label: 'Freelance' },
  { id: 'other', label: 'Other' }
]

const COLOR_CHOICES = [
  { id: 'var(--color-navy)', label: 'Navy' },
  { id: 'var(--color-sage)', label: 'Sage' },
  { id: 'var(--color-teal)', label: 'Teal' },
  { id: 'var(--color-terracotta)', label: 'Terracotta' },
  { id: 'var(--color-amber)', label: 'Amber' },
  { id: 'var(--color-violet)', label: 'Violet' }
]

const ACCOUNT_KIND_CHOICES = [
  { id: 'debit', label: 'Debit' },
  { id: 'credit', label: 'Credit' },
  { id: 'business', label: 'Business' },
  { id: 'cash', label: 'Cash' },
  { id: 'gateway', label: 'Gateway' }
]

function emptyCategoryForm() {
  return { name: '', ledger: 'personal', group: '', type: 'expense', stream: '', budget: '', color: COLOR_CHOICES[0].id }
}

function emptyAccountForm() {
  return { name: '', bank: '', kind: 'debit', last4: '', openingBalance: '0', openingDate: '', color: COLOR_CHOICES[0].id }
}

function CategoryModal({ open, editing, onClose, onSave }) {
  const [form, setForm] = useState(emptyCategoryForm)

  useEffect(() => {
    if (!open) return
    setForm(
      editing
        ? {
            name: editing.name,
            ledger: editing.ledger,
            group: editing.group || '',
            type: editing.type,
            stream: editing.stream || '',
            budget: editing.budget != null ? String(editing.budget) : '',
            color: editing.color || COLOR_CHOICES[0].id
          }
        : emptyCategoryForm()
    )
  }, [open, editing])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!form.name.trim()) return
    onSave({
      name: form.name.trim(),
      ledger: form.ledger,
      group: form.group.trim() || 'Other',
      type: form.type,
      stream: form.type === 'income' ? form.stream || null : null,
      budget: form.budget === '' ? null : Number(form.budget),
      color: form.color
    })
  }

  return (
    <Modal open={open} title={editing ? 'Edit category' : 'Add category'} onClose={onClose}>
      <form className="settings-form" onSubmit={handleSubmit}>
        <Field label="Name">
          <input value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
        </Field>
        <Field label="Ledger">
          <select value={form.ledger} onChange={(event) => updateField('ledger', event.target.value)}>
            {LEDGER_CHOICES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type">
          <select value={form.type} onChange={(event) => updateField('type', event.target.value)}>
            {TYPE_CHOICES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        {form.type === 'income' && (
          <Field label="Stream">
            <select value={form.stream} onChange={(event) => updateField('stream', event.target.value)}>
              {STREAM_CHOICES.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Group">
          <input value={form.group} onChange={(event) => updateField('group', event.target.value)} placeholder="e.g. Food" />
        </Field>
        <Field label="Monthly budget (AED)" hint="optional">
          <input type="number" min="0" step="1" value={form.budget} onChange={(event) => updateField('budget', event.target.value)} />
        </Field>
        <Field label="Color">
          <select value={form.color} onChange={(event) => updateField('color', event.target.value)}>
            {COLOR_CHOICES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="transaction-form__actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            {editing ? 'Save changes' : 'Add category'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function AccountModal({ open, editing, onClose, onSave }) {
  const [form, setForm] = useState(emptyAccountForm)

  useEffect(() => {
    if (!open) return
    setForm(
      editing
        ? {
            name: editing.name,
            bank: editing.bank || '',
            kind: editing.kind,
            last4: editing.last4 || '',
            openingBalance: String(editing.openingBalance ?? 0),
            openingDate: editing.openingDate || '',
            color: editing.color || COLOR_CHOICES[0].id
          }
        : emptyAccountForm()
    )
  }, [open, editing])

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    if (!form.name.trim()) return
    onSave({
      name: form.name.trim(),
      bank: form.bank.trim() || null,
      kind: form.kind,
      last4: form.last4.trim() || null,
      openingBalance: form.openingBalance === '' ? 0 : Number(form.openingBalance),
      openingDate: form.openingDate || null,
      color: form.color
    })
  }

  return (
    <Modal open={open} title={editing ? 'Edit account' : 'Add account'} onClose={onClose}>
      <form className="settings-form" onSubmit={handleSubmit}>
        <Field label="Name">
          <input value={form.name} onChange={(event) => updateField('name', event.target.value)} required />
        </Field>
        <Field label="Bank" hint="optional">
          <input value={form.bank} onChange={(event) => updateField('bank', event.target.value)} />
        </Field>
        <Field label="Kind">
          <select value={form.kind} onChange={(event) => updateField('kind', event.target.value)}>
            {ACCOUNT_KIND_CHOICES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Last 4 digits" hint="optional">
          <input value={form.last4} onChange={(event) => updateField('last4', event.target.value)} maxLength={4} />
        </Field>
        <Field label="Opening balance (AED)">
          <input
            type="number"
            step="0.01"
            value={form.openingBalance}
            onChange={(event) => updateField('openingBalance', event.target.value)}
          />
        </Field>
        <Field label="Opening date" hint="optional">
          <input type="date" value={form.openingDate} onChange={(event) => updateField('openingDate', event.target.value)} />
        </Field>
        <Field label="Color">
          <select value={form.color} onChange={(event) => updateField('color', event.target.value)}>
            {COLOR_CHOICES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="transaction-form__actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            {editing ? 'Save changes' : 'Add account'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function countCollections(data) {
  return Object.entries(data).map(([key, value]) => ({
    key,
    count: Array.isArray(value) ? value.length : value && typeof value === 'object' ? 1 : 0
  }))
}

export default function Settings() {
  const remountApp = useRemountApp()
  const showToast = useToast()

  const [categories, setCategories] = useState(() => getItem('categories', DEFAULT_CATEGORIES))
  const [accounts, setAccounts] = useState(() => getItem('accounts', DEFAULT_ACCOUNTS))

  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState(null)
  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)

  const [importPreview, setImportPreview] = useState(null) // { data, counts }
  const [importMode, setImportMode] = useState('merge')
  const [resetText, setResetText] = useState('')
  const fileInputRef = useRef(null)

  const [legacyPreview, setLegacyPreview] = useState(null) // mapLegacyBackup() result
  const legacyFileInputRef = useRef(null)

  const [importBatches, setImportBatches] = useState(() => getItem('importBatches', []))

  const [settings, setSettingsState] = useState(() => getItem('settings', { theme: 'system' }))

  function updateTheme(theme) {
    const nextSettings = { ...settings, theme }
    setSettingsState(nextSettings)
    setItem('settings', nextSettings)
    applyTheme(theme)
  }

  const [gsBusy, setGsBusy] = useState(false)
  const [gsStatus, setGsStatus] = useState('')

  function updateGoogleSheets(patch) {
    const nextGoogleSheets = { ...(settings.googleSheets || {}), ...patch }
    const nextSettings = { ...settings, googleSheets: nextGoogleSheets }
    setSettingsState(nextSettings)
    setItem('settings', nextSettings)
  }

  async function handleConnectGoogleSheets() {
    const { clientId, sheetId } = settings.googleSheets || {}
    if (!clientId || !sheetId) {
      setGsStatus('Enter both a Client ID and a Sheet ID first.')
      return
    }
    setGsBusy(true)
    setGsStatus('Requesting Google permission…')
    try {
      const token = await requestAccessToken(clientId, { silent: false })
      const transactions = getItem('transactions', [])
      const result = await pushTransactionsToSheet({ accessToken: token, sheetId, transactions })
      updateGoogleSheets({ connected: true, lastSyncedAt: new Date().toISOString() })
      setGsStatus(`Connected — synced ${result.rowCount} transaction${result.rowCount === 1 ? '' : 's'}.`)
    } catch (error) {
      setGsStatus(error.message || 'Could not connect to Google Sheets.')
    } finally {
      setGsBusy(false)
    }
  }

  async function handleSyncNow() {
    const { clientId, sheetId } = settings.googleSheets || {}
    if (!clientId || !sheetId) return
    setGsBusy(true)
    setGsStatus('Syncing…')
    try {
      const token = await requestAccessToken(clientId, { silent: true })
      const transactions = getItem('transactions', [])
      const result = await pushTransactionsToSheet({ accessToken: token, sheetId, transactions })
      updateGoogleSheets({ lastSyncedAt: new Date().toISOString() })
      setGsStatus(`Synced ${result.rowCount} transaction${result.rowCount === 1 ? '' : 's'}.`)
    } catch {
      updateGoogleSheets({ connected: false })
      setGsStatus('Session expired — click Connect to reconnect.')
    } finally {
      setGsBusy(false)
    }
  }

  function handleDisconnectGoogleSheets() {
    updateGoogleSheets({ connected: false })
    setGsStatus('Disconnected.')
  }

  function persistCategories(next) {
    setCategories(next)
    setItem('categories', next)
    remountApp()
  }

  function persistAccounts(next) {
    setAccounts(next)
    setItem('accounts', next)
    remountApp()
  }

  function openAddCategory() {
    setEditingCategory(null)
    setCategoryModalOpen(true)
  }

  function openEditCategory(category) {
    setEditingCategory(category)
    setCategoryModalOpen(true)
  }

  function saveCategory(fields) {
    if (editingCategory) {
      const oldName = editingCategory.name
      const renamed = fields.name !== oldName

      const nextCategories = categories.map((category) =>
        category.id === editingCategory.id ? { ...category, ...fields } : category
      )
      persistCategories(nextCategories)

      if (renamed) {
        const transactions = getItem('transactions', [])
        const nextTransactions = transactions.map((txn) => (txn.category === oldName ? { ...txn, category: fields.name } : txn))
        setItem('transactions', nextTransactions)
      }
    } else {
      const newCategory = { id: generateId(), isCustom: true, archived: false, ...fields }
      persistCategories([...categories, newCategory])
    }
    setCategoryModalOpen(false)
  }

  function toggleCategoryArchived(category) {
    persistCategories(categories.map((c) => (c.id === category.id ? { ...c, archived: !c.archived } : c)))
  }

  function openAddAccount() {
    setEditingAccount(null)
    setAccountModalOpen(true)
  }

  function openEditAccount(account) {
    setEditingAccount(account)
    setAccountModalOpen(true)
  }

  function saveAccount(fields) {
    if (editingAccount) {
      const oldName = editingAccount.name
      const renamed = fields.name !== oldName

      const nextAccounts = accounts.map((account) => (account.id === editingAccount.id ? { ...account, ...fields } : account))
      persistAccounts(nextAccounts)

      if (renamed) {
        const transactions = getItem('transactions', [])
        const nextTransactions = transactions.map((txn) =>
          txn.paymentMethod === oldName ? { ...txn, paymentMethod: fields.name } : txn
        )
        setItem('transactions', nextTransactions)
      }
    } else {
      const newAccount = { id: generateId(), ...fields }
      persistAccounts([...accounts, newAccount])
    }
    setAccountModalOpen(false)
  }

  function handleExport() {
    const data = exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `my-financials-export-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  async function handleFileSelected(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      setImportPreview({ data, counts: countCollections(data) })
    } catch {
      showToast('Could not read that file — is it a My Financials export?')
    }
    event.target.value = ''
  }

  function cancelImport() {
    setImportPreview(null)
    setImportMode('merge')
  }

  function confirmImport() {
    if (!importPreview) return
    const snapshot = exportAll()
    restoreSnapshot(importPreview.data, importMode)
    remountApp()
    showToast(`Imported ${importPreview.counts.length} collections (${importMode})`, {
      actionLabel: 'Undo',
      onAction: () => {
        restoreSnapshot(snapshot, 'replace')
        remountApp()
      }
    })
    setImportPreview(null)
    setImportMode('merge')
  }

  async function handleLegacyFileSelected(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const oldData = parseLegacyBackup(text)
      const mapped = mapLegacyBackup(oldData, { categories, accounts })
      setLegacyPreview(mapped)
    } catch (error) {
      showToast(error.message || 'Could not read that legacy backup file.')
    }
    event.target.value = ''
  }

  function cancelLegacyImport() {
    setLegacyPreview(null)
  }

  function confirmLegacyImport() {
    if (!legacyPreview) return
    const snapshot = exportAll()

    setItem('transactions', mergeById(getItem('transactions', []), legacyPreview.transactions))
    setItem('subscriptions', mergeById(getItem('subscriptions', []), legacyPreview.subscriptions))
    setItem('debts', mergeById(getItem('debts', []), legacyPreview.debts))
    setItem('savingsEntries', mergeById(getItem('savingsEntries', []), legacyPreview.savingsEntries))
    setItem('vatAdjustments', mergeVatAdjustments(getItem('vatAdjustments', []), legacyPreview.vatAdjustments))

    if (legacyPreview.newCategories.length > 0) {
      const nextCategories = [...categories, ...legacyPreview.newCategories]
      setCategories(nextCategories)
      setItem('categories', nextCategories)
    }
    if (legacyPreview.newAccounts.length > 0) {
      const nextAccounts = [...accounts, ...legacyPreview.newAccounts]
      setAccounts(nextAccounts)
      setItem('accounts', nextAccounts)
    }

    remountApp()

    const c = legacyPreview.counts
    showToast(
      `Imported ${c.transactions} transactions, ${c.subscriptions} subscriptions, ${c.debts} debts, ${c.savingsEntries} savings entries, ${c.vatAdjustments} VAT adjustments`,
      {
        actionLabel: 'Undo',
        onAction: () => {
          restoreSnapshot(snapshot, 'replace')
          remountApp()
        }
      }
    )
    setLegacyPreview(null)
  }

  function undoImportBatch(batch) {
    const transactions = getItem('transactions', [])
    const removed = transactions.filter((txn) => txn.importBatchId === batch.id)
    const remaining = transactions.filter((txn) => txn.importBatchId !== batch.id)
    const remainingBatches = importBatches.filter((b) => b.id !== batch.id)

    setItem('transactions', remaining)
    setImportBatches(remainingBatches)
    setItem('importBatches', remainingBatches)
    remountApp()

    showToast(`Removed ${removed.length} transaction${removed.length === 1 ? '' : 's'} from "${batch.label}"`, {
      actionLabel: 'Undo',
      onAction: () => {
        setItem('transactions', [...remaining, ...removed])
        const restoredBatches = [...remainingBatches, batch]
        setImportBatches(restoredBatches)
        setItem('importBatches', restoredBatches)
        remountApp()
      }
    })
  }

  function handleResetConfirmed() {
    const snapshot = exportAll()
    clearAll()
    remountApp()
    showToast('All data cleared', {
      actionLabel: 'Undo',
      onAction: () => {
        restoreSnapshot(snapshot, 'replace')
        remountApp()
      }
    })
    setResetText('')
  }

  return (
    <div className="screen">
      <h1>Settings</h1>

      <section className="settings-section">
        <div className="screen-header">
          <h2>Categories</h2>
          <button type="button" className="primary" onClick={openAddCategory}>
            Add category
          </button>
        </div>
        <ul className="settings-list">
          {categories.map((category) => (
            <li key={category.id} className="settings-list__item">
              <span className="swatch" style={{ background: category.color }} />
              <button type="button" className="link-button" onClick={() => openEditCategory(category)}>
                {category.name}
              </button>
              <span className="settings-list__meta">
                {LEDGER_CHOICES.find((l) => l.id === category.ledger)?.label ?? category.ledger} · {category.group}
                {category.budget ? ` · Budget ${category.budget} AED` : ''}
                {category.archived ? ' · Archived' : ''}
              </span>
              <button type="button" className="link-button" onClick={() => toggleCategoryArchived(category)}>
                {category.archived ? 'Unarchive' : 'Archive'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-section">
        <div className="screen-header">
          <h2>Accounts</h2>
          <button type="button" className="primary" onClick={openAddAccount}>
            Add account
          </button>
        </div>
        <ul className="settings-list">
          {accounts.map((account) => (
            <li key={account.id} className="settings-list__item">
              <span className="swatch" style={{ background: account.color }} />
              <button type="button" className="link-button" onClick={() => openEditAccount(account)}>
                {account.name}
              </button>
              <span className="settings-list__meta">
                {account.bank ? `${account.bank} · ` : ''}
                {ACCOUNT_KIND_CHOICES.find((k) => k.id === account.kind)?.label ?? account.kind}
                {account.last4 ? ` · •${account.last4}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-section">
        <h2>Data</h2>
        <div className="settings-actions">
          <button type="button" onClick={handleExport}>
            Export JSON
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()}>
            Import JSON
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleFileSelected} />
        </div>

        {importPreview && (
          <div className="import-preview">
            <h3>Import preview</h3>
            <ul className="import-preview__counts">
              {importPreview.counts.map((row) => (
                <li key={row.key}>
                  {row.key}: {row.count}
                </li>
              ))}
            </ul>
            <div className="chip-row">
              <button
                type="button"
                className={importMode === 'merge' ? 'chip-toggle chip-toggle--active' : 'chip-toggle'}
                onClick={() => setImportMode('merge')}
              >
                Merge
              </button>
              <button
                type="button"
                className={importMode === 'replace' ? 'chip-toggle chip-toggle--active' : 'chip-toggle'}
                onClick={() => setImportMode('replace')}
              >
                Replace
              </button>
            </div>
            <div className="transaction-form__actions">
              <button type="button" onClick={cancelImport}>
                Cancel
              </button>
              <ConfirmInline label="Import" confirmLabel="Confirm import" onConfirm={confirmImport} />
            </div>
          </div>
        )}
      </section>

      <section className="settings-section">
        <h2>Legacy import</h2>
        <p className="settings-hint">
          Reads the previous app's backup (old-my-financials.json — plain JSON, or RTF pasted into TextEdit) and maps its
          records into the current data model: transactions, subscriptions, debts, savings entries, and VAT
          adjustments. Unmapped categories or accounts are added as new custom entries automatically.
        </p>
        <div className="settings-actions">
          <button type="button" onClick={() => legacyFileInputRef.current?.click()}>
            Choose legacy backup
          </button>
          <input
            ref={legacyFileInputRef}
            type="file"
            accept=".json,.rtf,application/json,application/rtf,text/rtf,text/plain"
            hidden
            onChange={handleLegacyFileSelected}
          />
        </div>

        {legacyPreview && (
          <div className="import-preview">
            <h3>Import preview</h3>
            <ul className="import-preview__counts">
              <li>Transactions: {legacyPreview.counts.transactions}</li>
              <li>Subscriptions: {legacyPreview.counts.subscriptions}</li>
              <li>Debts: {legacyPreview.counts.debts}</li>
              <li>Savings entries: {legacyPreview.counts.savingsEntries}</li>
              <li>VAT adjustments: {legacyPreview.counts.vatAdjustments}</li>
              <li>New categories: {legacyPreview.counts.newCategories}</li>
              <li>New accounts: {legacyPreview.counts.newAccounts}</li>
            </ul>
            {legacyPreview.warnings.length > 0 && (
              <ul className="import-preview__warnings">
                {legacyPreview.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
            <div className="transaction-form__actions">
              <button type="button" onClick={cancelLegacyImport}>
                Cancel
              </button>
              <ConfirmInline label="Import legacy backup" confirmLabel="Confirm import" onConfirm={confirmLegacyImport} />
            </div>
          </div>
        )}
      </section>

      <section className="settings-section">
        <h2>Import batches</h2>
        {importBatches.length === 0 ? (
          <p className="settings-hint">Nothing imported yet — batches from Transactions → Import show up here, undoable as a whole.</p>
        ) : (
          <ul className="settings-list">
            {importBatches.map((batch) => (
              <li key={batch.id} className="settings-list__item">
                <span>{batch.label}</span>
                <span className="settings-list__meta">
                  {batch.sourceName} · {batch.count} transaction{batch.count === 1 ? '' : 's'} · {formatDate(batch.createdAt)}
                </span>
                <ConfirmInline label="Undo batch" confirmLabel="Confirm undo" onConfirm={() => undoImportBatch(batch)} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="settings-section">
        <h2>Google Sheets backup</h2>
        <p className="settings-hint">
          Mirrors your transactions to a Google Sheet automatically as you add or edit them — a real off-device backup, unlike
          this app's own storage which lives only in this browser. Needs a Google Cloud OAuth Client ID and the target sheet's
          ID (from its URL).
        </p>
        <Field label="OAuth Client ID">
          <input
            value={settings.googleSheets?.clientId || ''}
            onChange={(event) => updateGoogleSheets({ clientId: event.target.value })}
            placeholder="xxxxx.apps.googleusercontent.com"
          />
        </Field>
        <Field label="Sheet ID" hint="From the sheet's URL: docs.google.com/spreadsheets/d/THIS_PART/edit">
          <input
            value={settings.googleSheets?.sheetId || ''}
            onChange={(event) => updateGoogleSheets({ sheetId: event.target.value })}
            placeholder="1xYMuROUj1-6X89rEo1oYAEmw76Hf2sY0YiYSQxgnKa0"
          />
        </Field>
        <div className="settings-actions">
          <button type="button" onClick={handleConnectGoogleSheets} disabled={gsBusy}>
            {settings.googleSheets?.connected ? 'Reconnect' : 'Connect'}
          </button>
          {settings.googleSheets?.connected && (
            <>
              <button type="button" onClick={handleSyncNow} disabled={gsBusy}>
                Sync now
              </button>
              <ConfirmInline label="Disconnect" confirmLabel="Confirm" onConfirm={handleDisconnectGoogleSheets} />
            </>
          )}
        </div>
        {gsStatus && <p className="settings-hint">{gsStatus}</p>}
        {settings.googleSheets?.connected && settings.googleSheets?.lastSyncedAt && (
          <p className="settings-hint">
            Connected · last synced {formatDate(settings.googleSheets.lastSyncedAt)} · auto-syncs a few seconds after any change.
          </p>
        )}
      </section>

      <section className="settings-section">
        <h2>Appearance</h2>
        <div className="chip-row">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              className={settings.theme === option ? 'chip-toggle chip-toggle--active' : 'chip-toggle'}
              onClick={() => updateTheme(option)}
            >
              {option === 'system' ? 'System' : option === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section">
        <h2>Reset</h2>
        <p className="settings-hint">Type RESET to clear all app data. This cannot be undone after the 6-second undo window closes.</p>
        <div className="settings-actions">
          <input
            className="reset-input"
            value={resetText}
            onChange={(event) => setResetText(event.target.value)}
            placeholder="Type RESET"
          />
          {resetText === 'RESET' ? (
            <ConfirmInline label="Clear all data" confirmLabel="Confirm clear" onConfirm={handleResetConfirmed} />
          ) : (
            <button type="button" disabled>
              Clear all data
            </button>
          )}
        </div>
      </section>

      <p className="money settings-version">
        App v{packageJson.version} · Schema v{SCHEMA_VERSION}
      </p>

      <CategoryModal
        open={categoryModalOpen}
        editing={editingCategory}
        onClose={() => setCategoryModalOpen(false)}
        onSave={saveCategory}
      />
      <AccountModal open={accountModalOpen} editing={editingAccount} onClose={() => setAccountModalOpen(false)} onSave={saveAccount} />
    </div>
  )
}
