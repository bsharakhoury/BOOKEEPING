import { useMemo, useState } from 'react'
import { Card } from '../ui/Card.jsx'
import { Stat } from '../ui/Stat.jsx'
import { Chip } from '../ui/Chip.jsx'
import { Bar } from '../ui/Bar.jsx'
import { usePersistedState } from '../../lib/storage.js'
import { formatMoney } from '../../lib/money.js'
import { addDays, formatDate, monthKey, monthLabel, todayISO } from '../../lib/dates.js'
import { accountBalances, budgetProgress, rangeForView, totalCashPosition, totalsForRange, upcomingObligations } from '../../lib/derive/totals.js'
import { rollForwardDueDates } from '../../lib/derive/subscriptions.js'
import { invoiceStatus } from '../../lib/derive/invoices.js'
import { findDuplicateGroups } from '../../lib/duplicates.js'
import { periodDueDate, periodKeyForDate } from '../../data/vatPeriods.js'
import { vatForPeriod } from '../../lib/derive/vat.js'
import { DEFAULT_CATEGORIES } from '../../data/categories.js'
import { DEFAULT_ACCOUNTS } from '../../data/accounts.js'
import { DEFAULT_FX_RATES } from '../../lib/fx.js'

const VIEW_OPTIONS = [
  { id: 'month', label: 'Month' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'ytd', label: 'YTD' }
]

export default function Dashboard() {
  const [transactions] = usePersistedState('transactions', [])
  const [categories] = usePersistedState('categories', DEFAULT_CATEGORIES)
  const [accounts] = usePersistedState('accounts', DEFAULT_ACCOUNTS)
  const [subscriptions] = usePersistedState('subscriptions', [])
  const [debts] = usePersistedState('debts', [])
  const [invoices] = usePersistedState('invoices', [])
  const [vatAdjustments] = usePersistedState('vatAdjustments', [])
  const [settings] = usePersistedState('settings', { rent: 12500, rentCycleMonths: 3, fx: DEFAULT_FX_RATES })

  const today = todayISO()
  const [selectedMonth, setSelectedMonth] = useState(monthKey(today))
  const [view, setView] = useState('month')

  const months = useMemo(() => {
    const set = new Set(transactions.map((txn) => monthKey(txn.date)))
    set.add(monthKey(today))
    return Array.from(set).sort().reverse()
  }, [transactions, today])

  const range = useMemo(() => rangeForView(selectedMonth, view), [selectedMonth, view])
  const totals = useMemo(() => totalsForRange(transactions, range), [transactions, range])
  const cashPosition = useMemo(() => totalCashPosition(accounts, transactions), [accounts, transactions])
  const balances = useMemo(() => accountBalances(accounts, transactions), [accounts, transactions])

  const rolledSubscriptions = useMemo(() => rollForwardDueDates(subscriptions, today), [subscriptions, today])
  const upcoming = useMemo(
    () => upcomingObligations(rolledSubscriptions, debts, settings, { today, days: 14 }),
    [rolledSubscriptions, debts, settings, today]
  )

  const currentVatPeriod = useMemo(() => periodKeyForDate(today), [today])
  const vatResult = useMemo(
    () => vatForPeriod(currentVatPeriod, { invoices, transactions, vatAdjustments }),
    [currentVatPeriod, invoices, transactions, vatAdjustments]
  )
  const vatDueDate = periodDueDate(currentVatPeriod)
  const vatDaysLeft = vatDueDate ? Math.ceil((new Date(vatDueDate) - new Date(today)) / 86400000) : null

  const budgets = useMemo(() => budgetProgress(categories, transactions, range), [categories, transactions, range])

  const needsAttention = useMemo(() => {
    const items = []

    const uncategorised = transactions.filter((txn) => !txn.category)
    if (uncategorised.length > 0) items.push({ label: `${uncategorised.length} uncategorised transaction${uncategorised.length === 1 ? '' : 's'}` })

    const overdueInvoices = invoices.filter((invoice) => invoiceStatus(invoice, today) === 'overdue')
    if (overdueInvoices.length > 0) items.push({ label: `${overdueInvoices.length} overdue invoice${overdueInvoices.length === 1 ? '' : 's'}` })

    const dueSoonSubs = rolledSubscriptions.filter((sub) => sub.active && sub.nextDue && sub.nextDue <= addDays(today, 3))
    if (dueSoonSubs.length > 0) items.push({ label: `${dueSoonSubs.length} subscription${dueSoonSubs.length === 1 ? '' : 's'} due within 3 days` })

    const duplicateGroups = findDuplicateGroups(transactions)
    if (duplicateGroups.length > 0) items.push({ label: `${duplicateGroups.length} possible duplicate group${duplicateGroups.length === 1 ? '' : 's'}` })

    if (vatDaysLeft != null && vatDaysLeft <= 21 && vatDaysLeft >= 0) items.push({ label: `VAT due in ${vatDaysLeft} day${vatDaysLeft === 1 ? '' : 's'}` })

    return items
  }, [transactions, invoices, rolledSubscriptions, vatDaysLeft, today])

  const recentActivity = useMemo(
    () => [...transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 10),
    [transactions]
  )

  return (
    <div className="screen">
      <div className="screen-header">
        <h1>Dashboard</h1>
        <div className="chip-row">
          {VIEW_OPTIONS.map((option) => (
            <Chip key={option.id} label={option.label} active={view === option.id} onClick={() => setView(option.id)} />
          ))}
        </div>
      </div>

      <div className="chip-row">
        {months.map((month) => (
          <Chip key={month} label={monthLabel(month)} active={selectedMonth === month} onClick={() => setSelectedMonth(month)} />
        ))}
      </div>

      <div className="dashboard-hero">
        <span className="dashboard-hero__label">Net this {view}</span>
        <span className={`dashboard-hero__value money money--${totals.net >= 0 ? 'income' : 'expense'}`}>{formatMoney(totals.net)}</span>
      </div>

      <div className="dashboard-cards">
        <Card title="Income">
          <Stat label="" value={formatMoney(totals.income)} tone="income" />
        </Card>
        <Card title="Personal">
          <Stat label="" value={formatMoney(totals.personalExpense)} tone="expense" />
        </Card>
        <Card title="Business">
          <Stat label="" value={formatMoney(totals.businessExpense)} tone="expense" />
        </Card>
        <Card title="Cash position">
          <Stat label="" value={formatMoney(cashPosition)} tone="income" />
          <ul className="dashboard-account-list">
            {balances.map((entry) => (
              <li key={entry.account.id}>
                <span>{entry.account.name}</span>
                <span>{formatMoney(entry.balance)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Upcoming 14 days">
          {upcoming.length === 0 ? (
            <p className="settings-hint">Nothing due.</p>
          ) : (
            <ul className="dashboard-account-list">
              {upcoming.map((item, index) => (
                <li key={index}>
                  <span>
                    {item.label}
                    {item.date ? ` · ${formatDate(item.date)}` : ''}
                  </span>
                  <span className="money money--expense">{formatMoney(item.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="VAT accrued">
          <Stat label="" value={formatMoney(vatResult.netPayable)} tone="expense" />
          <p className="settings-hint">
            {vatDueDate ? `Due ${formatDate(vatDueDate)}` : 'No period'}
            {vatDaysLeft != null ? ` · ${vatDaysLeft} day${vatDaysLeft === 1 ? '' : 's'} left` : ''}
          </p>
        </Card>
      </div>

      {budgets.length > 0 && (
        <section className="settings-section">
          <h2>Budgets</h2>
          <ul className="settings-list">
            {budgets.map((entry) => (
              <li key={entry.category.id} className="settings-list__item dashboard-budget-row">
                <span>{entry.category.name}</span>
                <Bar value={entry.spent} max={entry.budget} color={entry.pct >= 100 ? 'var(--color-terracotta)' : 'var(--color-sage)'} />
                <span className="settings-list__meta">
                  {formatMoney(entry.spent)} / {formatMoney(entry.budget)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="settings-section">
        <h2>Needs attention</h2>
        {needsAttention.length === 0 ? (
          <p className="settings-hint">All clear.</p>
        ) : (
          <ul className="settings-list">
            {needsAttention.map((item, index) => (
              <li key={index} className="settings-list__item">
                <span className="dup-flag">{item.label}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="settings-section">
        <h2>Recent activity</h2>
        {recentActivity.length === 0 ? (
          <p className="settings-hint">No transactions yet.</p>
        ) : (
          <ul className="settings-list">
            {recentActivity.map((txn) => (
              <li key={txn.id} className="settings-list__item">
                <span>{txn.merchant}</span>
                <span className="settings-list__meta">
                  {formatDate(txn.date)} · {txn.category}
                </span>
                <span className={`money money--${txn.type}`}>{formatMoney(txn.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

