import { useMemo, useState } from 'react'
import { Table } from '../ui/Table.jsx'
import { ConfirmInline } from '../ui/ConfirmInline.jsx'
import { categorise } from '../../lib/parsers/categorise.js'
import { findDuplicateIndex } from '../../lib/duplicates.js'
import { formatMoney } from '../../lib/money.js'

const LEDGER_OPTIONS = [
  { id: 'personal', label: 'Personal' },
  { id: 'business', label: 'Mashreq business' },
  { id: 'lh_business', label: 'Leaf & Hook' },
  { id: 'income', label: 'Income' }
]

export function ImportPreview({ rawRows, meta, categories, accounts, merchantRules, existingTransactions, onCancel, onCommit }) {
  const initialRows = useMemo(
    () =>
      rawRows.map((row, index) => {
        const withCategory = categorise(row, { merchantRules })
        const isDuplicate = findDuplicateIndex(withCategory, existingTransactions) !== -1
        return { ...withCategory, _key: `${meta.parserId}-${index}`, skip: isDuplicate, isDuplicate, rememberMerchant: false }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [rows, setRows] = useState(initialRows)

  function updateRow(key, patch) {
    setRows((prev) => prev.map((row) => (row._key === key ? { ...row, ...patch } : row)))
  }

  const includedCount = rows.filter((row) => !row.skip).length
  const duplicateCount = rows.filter((row) => row.isDuplicate).length

  const columns = [
    {
      key: 'include',
      label: 'Add',
      render: (row) => (
        <input
          type="checkbox"
          checked={!row.skip}
          onChange={(event) => updateRow(row._key, { skip: !event.target.checked })}
          aria-label="Include this row"
        />
      )
    },
    { key: 'date', label: 'Date' },
    {
      key: 'merchant',
      label: 'Merchant',
      render: (row) => (
        <span>
          {row.isDuplicate && <span className="dup-flag">Possible duplicate</span>}
          {row.merchant}
        </span>
      )
    },
    {
      key: 'category',
      label: 'Category',
      render: (row) =>
        row.type === 'transfer' ? (
          <span className="settings-list__meta">Transfer</span>
        ) : (
          <select value={row.category || ''} onChange={(event) => updateRow(row._key, { category: event.target.value })}>
            {categories
              .filter((category) => !category.archived)
              .map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
          </select>
        )
    },
    {
      key: 'ledger',
      label: 'Ledger',
      render: (row) => (
        <select value={row.ledger} onChange={(event) => updateRow(row._key, { ledger: event.target.value })}>
          {LEDGER_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      )
    },
    {
      key: 'paymentMethod',
      label: 'Account',
      render: (row) => (
        <select value={row.paymentMethod || ''} onChange={(event) => updateRow(row._key, { paymentMethod: event.target.value })}>
          {accounts.map((account) => (
            <option key={account.id} value={account.name}>
              {account.name}
            </option>
          ))}
        </select>
      )
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (row) => <span className={`money money--${row.type}`}>{formatMoney(row.amount)}</span>
    },
    {
      key: 'remember',
      label: 'Remember merchant',
      render: (row) => (
        <input
          type="checkbox"
          checked={row.rememberMerchant}
          onChange={(event) => updateRow(row._key, { rememberMerchant: event.target.checked })}
          aria-label="Remember this merchant for future imports"
        />
      )
    }
  ]

  return (
    <div className="import-preview-panel">
      <p className="settings-hint">
        {meta.label} · {meta.sourceName} · {rows.length} row{rows.length === 1 ? '' : 's'} detected
        {duplicateCount > 0 ? `, ${duplicateCount} possible duplicate${duplicateCount === 1 ? '' : 's'} unchecked` : ''}.
      </p>
      <div className="import-preview-table">
        <Table columns={columns} rows={rows.map((row) => ({ ...row, id: row._key }))} />
      </div>
      <div className="transaction-form__actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <ConfirmInline
          label={`Import ${includedCount} transaction${includedCount === 1 ? '' : 's'}`}
          confirmLabel="Confirm import"
          onConfirm={() => onCommit(rows.filter((row) => !row.skip))}
        />
      </div>
    </div>
  )
}
