import { useMemo, useState } from 'react'
import { Card } from '../ui/Card.jsx'
import { Chip } from '../ui/Chip.jsx'
import { Table } from '../ui/Table.jsx'
import { CategoryTag } from '../ui/CategoryTag.jsx'
import { usePersistedState } from '../../lib/storage.js'
import { formatMoney } from '../../lib/money.js'
import { formatDate, monthKey, monthLabel } from '../../lib/dates.js'
import { DEFAULT_CATEGORIES } from '../../data/categories.js'

const STREAM_LABELS = {
  salary: 'Salary',
  lh_media: 'Leaf & Hook – Media',
  lh_wellness: 'Leaf & Hook – Wellness',
  freelance: 'Freelance',
  other: 'Other',
  none: 'Uncategorised'
}

const STREAM_ORDER = ['salary', 'lh_media', 'lh_wellness', 'freelance', 'other', 'none']

function clientFromTags(tags) {
  const tag = (tags || []).find((t) => t.toLowerCase().startsWith('client:'))
  return tag ? tag.slice('client:'.length).trim() : null
}

export default function Income() {
  const [transactions] = usePersistedState('transactions', [])
  const [categories] = usePersistedState('categories', DEFAULT_CATEGORIES)
  const [monthFilter, setMonthFilter] = useState('all')

  const streamByCategory = useMemo(() => {
    const map = new Map()
    categories.forEach((category) => {
      if (category.type === 'income') map.set(category.name, category.stream || 'none')
    })
    return map
  }, [categories])

  const income = useMemo(() => transactions.filter((txn) => txn.type === 'income'), [transactions])

  const months = useMemo(() => {
    const set = new Set(income.map((txn) => monthKey(txn.date)))
    return Array.from(set).sort().reverse()
  }, [income])

  const filtered = useMemo(
    () => (monthFilter === 'all' ? income : income.filter((txn) => monthKey(txn.date) === monthFilter)),
    [income, monthFilter]
  )

  const streamTotals = useMemo(() => {
    const totals = new Map()
    filtered.forEach((txn) => {
      const stream = streamByCategory.get(txn.category) || 'none'
      totals.set(stream, (totals.get(stream) || 0) + Number(txn.amount || 0))
    })
    return totals
  }, [filtered, streamByCategory])

  const clientTotals = useMemo(() => {
    const totals = new Map()
    filtered.forEach((txn) => {
      const client = clientFromTags(txn.tags) || 'Unassigned'
      totals.set(client, (totals.get(client) || 0) + Number(txn.amount || 0))
    })
    return Array.from(totals.entries()).sort((a, b) => b[1] - a[1])
  }, [filtered])

  const total = filtered.reduce((sum, txn) => sum + Number(txn.amount || 0), 0)

  const columns = [
    { key: 'date', label: 'Date', render: (txn) => formatDate(txn.date) },
    { key: 'merchant', label: 'Source' },
    { key: 'category', label: 'Category', render: (txn) => <CategoryTag name={txn.category} categories={categories} /> },
    { key: 'stream', label: 'Stream', render: (txn) => STREAM_LABELS[streamByCategory.get(txn.category) || 'none'] },
    { key: 'client', label: 'Client', render: (txn) => clientFromTags(txn.tags) || '—' },
    { key: 'amount', label: 'Amount', render: (txn) => <span className="money money--income">{formatMoney(txn.amount)}</span> },
    { key: 'invoice', label: 'Invoice', render: (txn) => txn.linkedInvoiceId || '—' }
  ]

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Income</h1>
        <span className="money money--income">{formatMoney(total)}</span>
      </div>

      <div className="chip-row">
        <Chip label="All months" active={monthFilter === 'all'} onClick={() => setMonthFilter('all')} />
        {months.map((month) => (
          <Chip key={month} label={monthLabel(month)} active={monthFilter === month} onClick={() => setMonthFilter(month)} />
        ))}
      </div>

      <div className="income-buckets">
        {STREAM_ORDER.filter((stream) => streamTotals.has(stream)).map((stream) => (
          <Card key={stream} title={STREAM_LABELS[stream]}>
            <span className="money money--income">{formatMoney(streamTotals.get(stream))}</span>
          </Card>
        ))}
      </div>

      <section className="settings-section">
        <h2>By client</h2>
        {clientTotals.length === 0 ? (
          <p className="settings-hint">No income in this range.</p>
        ) : (
          <ul className="settings-list">
            {clientTotals.map(([client, amount]) => (
              <li key={client} className="settings-list__item">
                <span>{client}</span>
                <span className="money money--income">{formatMoney(amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Table columns={columns} rows={filtered} emptyMessage="No income transactions yet." />
    </div>
  )
}
