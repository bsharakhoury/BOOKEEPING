import { useState } from 'react'
import { ConfirmInline } from '../ui/ConfirmInline.jsx'
import { formatMoney } from '../../lib/money.js'
import { formatDate } from '../../lib/dates.js'

// Where an unconfirmed entry most plausibly belongs instead: a salary/dividend that really landed
// in the personal account, or a payment-processor row that was filed under the bank.
const MOVE_TARGETS = { income: ['Mashreq Debit 9437', 'Stripe'], expense: ['Stripe'] }

export function ReconcilePreview({ result, meta, onCancel, onApply }) {
  const { updates, additions, flagged } = result
  // id -> 'remove' | 'move:<account>'; anything absent is kept as it is.
  const [choices, setChoices] = useState({})

  function setChoice(id, value) {
    setChoices((prev) => {
      const next = { ...prev }
      if (value === 'keep') delete next[id]
      else next[id] = value
      return next
    })
  }

  const deleteIds = Object.keys(choices).filter((id) => choices[id] === 'remove')
  const moves = Object.entries(choices)
    .filter(([, value]) => value.startsWith('move:'))
    .map(([id, value]) => ({ id, paymentMethod: value.slice('move:'.length) }))
  const changeCount = updates.length + deleteIds.length + moves.length

  const parts = [`${updates.length} correction${updates.length === 1 ? '' : 's'}`]
  if (moves.length > 0) parts.push(`move ${moves.length}`)
  if (deleteIds.length > 0) parts.push(`remove ${deleteIds.length}`)

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
            Could be a temporary card hold that was never charged, an entry recorded against the wrong account or in the wrong
            direction, or something paid from elsewhere. Choose what to do with each — the default is to keep it.
          </p>
          <ul className="settings-list">
            {flagged.map((t) => (
              <li key={t.id} className="settings-list__item">
                <span>{t.merchant}</span>
                <span className="settings-list__meta">
                  {formatDate(t.date)} · {formatMoney(t.amount)} · {t.type}
                </span>
                <select
                  value={choices[t.id] || 'keep'}
                  onChange={(event) => setChoice(t.id, event.target.value)}
                  aria-label={`What to do with ${t.merchant}`}
                >
                  <option value="keep">Keep</option>
                  <option value="remove">Remove</option>
                  {(MOVE_TARGETS[t.type] || [])
                    .filter((account) => account !== t.paymentMethod)
                    .map((account) => (
                      <option key={account} value={`move:${account}`}>
                        Move to {account}
                      </option>
                    ))}
                </select>
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
          label={changeCount === 0 ? 'Continue' : `Apply: ${parts.join(', ')}`}
          confirmLabel="Confirm"
          onConfirm={() => onApply(updates, deleteIds, moves)}
        />
      </div>
    </div>
  )
}
