import { useMemo } from 'react'
import { ConfirmInline } from '../ui/ConfirmInline.jsx'
import { useToast } from '../ui/Toast.jsx'
import { usePersistedState } from '../../lib/storage.js'
import { findDuplicateGroups, findFuzzyDuplicateGroups } from '../../lib/duplicates.js'
import { formatMoney } from '../../lib/money.js'
import { formatDate } from '../../lib/dates.js'

function DuplicateGroup({ group, kind, onKeep, onIgnore }) {
  return (
    <li className="settings-list__item duplicate-group">
      <div className="duplicate-group__header">
        <span className="dup-flag">{kind === 'exact' ? 'Exact match' : 'Possible match'}</span>
        <ConfirmInline label="Ignore group" confirmLabel="Confirm" onConfirm={() => onIgnore(group)} />
      </div>
      <ul className="duplicate-group__rows">
        {group.transactions.map((txn) => (
          <li key={txn.id}>
            <span>{formatDate(txn.date)}</span>
            <span>{txn.merchant}</span>
            <span>{txn.paymentMethod}</span>
            <span className="money money--expense">{formatMoney(txn.amount)}</span>
            <ConfirmInline label="Keep this one" confirmLabel="Confirm" onConfirm={() => onKeep(group, txn)} />
          </li>
        ))}
      </ul>
    </li>
  )
}

export default function Duplicates() {
  const [transactions, setTransactions] = usePersistedState('transactions', [])
  const [ignored, setIgnored] = usePersistedState('ignoredDuplicates', [])
  const showToast = useToast()

  const ignoredSet = useMemo(() => new Set(ignored), [ignored])

  const exactGroups = useMemo(
    () => findDuplicateGroups(transactions).filter((group) => !ignoredSet.has(group.key)),
    [transactions, ignoredSet]
  )
  const fuzzyGroups = useMemo(
    () => findFuzzyDuplicateGroups(transactions).filter((group) => !ignoredSet.has(group.key)),
    [transactions, ignoredSet]
  )

  function handleIgnore(group) {
    setIgnored((prev) => [...prev, group.key])
    showToast('Group ignored', { actionLabel: 'Undo', onAction: () => setIgnored((prev) => prev.filter((key) => key !== group.key)) })
  }

  function handleKeep(group, keeper) {
    const removedIds = new Set(group.transactions.filter((txn) => txn.id !== keeper.id).map((txn) => txn.id))
    const removed = transactions.filter((txn) => removedIds.has(txn.id))
    setTransactions((prev) => prev.filter((txn) => !removedIds.has(txn.id)))
    showToast(`Kept "${keeper.merchant}", removed ${removed.length} duplicate${removed.length === 1 ? '' : 's'}`, {
      actionLabel: 'Undo',
      onAction: () => setTransactions((prev) => [...prev, ...removed])
    })
  }

  const totalGroups = exactGroups.length + fuzzyGroups.length

  return (
    <div className="screen">
      <h1>Duplicates</h1>
      <p className="settings-hint">
        {totalGroups === 0 ? 'No duplicates found.' : `${totalGroups} possible duplicate group${totalGroups === 1 ? '' : 's'}.`}
      </p>

      {exactGroups.length > 0 && (
        <section className="settings-section">
          <h2>Exact matches</h2>
          <ul className="settings-list">
            {exactGroups.map((group) => (
              <DuplicateGroup key={group.key} group={group} kind="exact" onKeep={handleKeep} onIgnore={handleIgnore} />
            ))}
          </ul>
        </section>
      )}

      {fuzzyGroups.length > 0 && (
        <section className="settings-section">
          <h2>Possible matches</h2>
          <ul className="settings-list">
            {fuzzyGroups.map((group) => (
              <DuplicateGroup key={group.key} group={group} kind="fuzzy" onKeep={handleKeep} onIgnore={handleIgnore} />
            ))}
          </ul>
        </section>
      )}

      {ignored.length > 0 && (
        <p className="settings-hint">{ignored.length} group{ignored.length === 1 ? '' : 's'} ignored.</p>
      )}
    </div>
  )
}
