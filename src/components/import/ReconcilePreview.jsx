import { useState } from 'react'
import { ConfirmInline } from '../ui/ConfirmInline.jsx'
import { formatMoney } from '../../lib/money.js'
import { formatDate } from '../../lib/dates.js'

export function ReconcilePreview({ result, meta, onCancel, onApply }) {
  const { updates, additions, flagged } = result
  const [deleteIds, setDeleteIds] = useState(() => new Set())

  function toggleDelete(id) {
    setDeleteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="import-preview-panel">
      <p className="settings-hint">
        {meta.label} · {meta.sourceName} — checked against what's already in your data for this period.
      </p>

      {updates.length > 0 && (
        <section className="settings-section">
          <h3>Will correct {updates.length} existing entr{updates.length === 1 ? 'y' : 'ies'}</h3>
          <p className="settings-hint">Date and/or amount will be updated to match the statement. Category and notes stay as they are.</p>
          <ul className="settings-list">
            {updates.map((u) => (
              <li key={u.id} className="settings-list__item">
                <span>{u.before.merchant}</span>
                <span className="settings-list__meta">
                  {formatDate(u.before.date)} {formatMoney(u.before.amount)} → {formatDate(u.after.date)} {formatMoney(u.after.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {flagged.length > 0 && (
        <section className="settings-section">
          <h3>Not found in this statement — {flagged.length} entr{flagged.length === 1 ? 'y' : 'ies'}</h3>
          <p className="settings-hint">
            Often a temporary card hold that was never actually charged, but check before removing — some legitimately
            just don't appear on this account's statement (paid by another account, or posted outside this period).
          </p>
          <ul className="settings-list">
            {flagged.map((t) => (
              <li key={t.id} className="settings-list__item">
                <input
                  type="checkbox"
                  checked={deleteIds.has(t.id)}
                  onChange={() => toggleDelete(t.id)}
                  aria-label={`Remove ${t.merchant}`}
                />
                <span>{t.merchant}</span>
                <span className="settings-list__meta">
                  {formatDate(t.date)} · {formatMoney(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="settings-hint">
        {additions.length === 0
          ? 'No new transactions in this statement.'
          : `${additions.length} new transaction${additions.length === 1 ? '' : 's'} found — you'll categorise ${additions.length === 1 ? 'it' : 'them'} next.`}
      </p>

      <div className="transaction-form__actions">
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
        <ConfirmInline
          label={deleteIds.size > 0 ? `Apply ${updates.length} correction${updates.length === 1 ? '' : 's'} and remove ${deleteIds.size}` : `Apply ${updates.length} correction${updates.length === 1 ? '' : 's'} and continue`}
          confirmLabel="Confirm"
          onConfirm={() => onApply(updates, Array.from(deleteIds))}
        />
      </div>
    </div>
  )
}
