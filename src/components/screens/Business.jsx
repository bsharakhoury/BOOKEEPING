import { useMemo, useState } from 'react'
import { Chip } from '../ui/Chip.jsx'
import { Table } from '../ui/Table.jsx'
import { usePersistedState } from '../../lib/storage.js'
import { useNavigate } from '../../lib/navigationContext.js'
import { formatMoney } from '../../lib/money.js'
import { formatDate, monthKey, monthLabel } from '../../lib/dates.js'

const LEDGER_LABELS = { business: 'Mashreq business', lh_business: 'Leaf & Hook' }
const BUSINESS_LEDGERS = new Set(['business', 'lh_business'])

export default function Business() {
  const [transactions] = usePersistedState('transactions', [])
  const [monthFilter, setMonthFilter] = useState('all')
  const navigate = useNavigate()

  const businessTxns = useMemo(
    () => transactions.filter((txn) => BUSINESS_LEDGERS.has(txn.ledger) && (txn.type === 'expense' || txn.type === 'refund')),
    [transactions]
  )

  const months = useMemo(() => {
    const set = new Set(businessTxns.map((txn) => monthKey(txn.date)))
    return Array.from(set).sort().reverse()
  }, [businessTxns])

  const filtered = useMemo(
    () => (monthFilter === 'all' ? businessTxns : businessTxns.filter((txn) => monthKey(txn.date) === monthFilter)),
    [businessTxns, monthFilter]
  )

  const total = filtered.reduce((sum, txn) => sum + (txn.type === 'refund' ? -txn.amount : txn.amount), 0)

  const sorted = useMemo(() => [...filtered].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)), [filtered])

  const columns = [
    { key: 'date', label: 'Date', render: (txn) => formatDate(txn.date) },
    { key: 'merchant', label: 'Merchant' },
    { key: 'category', label: 'Category' },
    { key: 'ledger', label: 'Ledger', render: (txn) => LEDGER_LABELS[txn.ledger] ?? txn.ledger },
    { key: 'paymentMethod', label: 'Account' },
    {
      key: 'amount',
      label: 'Amount',
      render: (txn) => <span className={`money money--${txn.type === 'refund' ? 'refund' : 'expense'}`}>{formatMoney(txn.amount)}</span>
    }
  ]

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Business (L&H)</h1>
        <div className="screen-header__actions">
          <button type="button" onClick={() => navigate('invoices')}>
            Invoices →
          </button>
          <button type="button" onClick={() => navigate('vat')}>
            VAT →
          </button>
        </div>
      </div>

      <p className="settings-hint">Mashreq business spend and Leaf & Hook (RAK Bank) expenses combined.</p>

      <div className="chip-row">
        <Chip label="All months" active={monthFilter === 'all'} onClick={() => setMonthFilter('all')} />
        {months.map((month) => (
          <Chip key={month} label={monthLabel(month)} active={monthFilter === month} onClick={() => setMonthFilter(month)} />
        ))}
      </div>

      <div className="dashboard-hero">
        <span className="dashboard-hero__label">Business expenses</span>
        <span className="dashboard-hero__value money money--expense">{formatMoney(total)}</span>
      </div>

      <Table columns={columns} rows={sorted} emptyMessage="No business expenses yet." />
    </div>
  )
}
