import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '../ui/Card.jsx'
import { Stat } from '../ui/Stat.jsx'
import { Chip } from '../ui/Chip.jsx'
import { Field } from '../ui/Field.jsx'
import { CategoryTag } from '../ui/CategoryTag.jsx'
import { usePersistedState } from '../../lib/storage.js'
import { formatMoney } from '../../lib/money.js'
import { lastNMonthKeys, monthKey, monthKeysInRange, monthLabel, todayISO, ytdRange } from '../../lib/dates.js'
import {
  cashFlowSeries,
  categoryTrend,
  customRangeReport,
  incomeByClient,
  incomeByStream,
  lhProfitAndLoss,
  monthOverMonthVariance,
  runwayMonths
} from '../../lib/derive/reports.js'
import { totalCashPosition } from '../../lib/derive/totals.js'
import { downloadCsv } from '../../lib/csvExport.js'
import { DEFAULT_CATEGORIES } from '../../data/categories.js'
import { DEFAULT_ACCOUNTS } from '../../data/accounts.js'

const LEDGER_OPTIONS = [
  { id: 'personal', label: 'Personal' },
  { id: 'business', label: 'Business' },
  { id: 'lh_business', label: 'Leaf & Hook' },
  { id: 'income', label: 'Income' }
]

function CategoryBar({ row, max }) {
  const width = max > 0 ? Math.max(4, Math.round((Math.abs(row.amount) / max) * 100)) : 0
  return (
    <div className="bar">
      <div className="bar__fill" style={{ width: `${width}%`, background: row.color || 'var(--color-navy)' }} />
    </div>
  )
}

function CategoryAmountList({ rows, tone, categories }) {
  const max = rows.reduce((m, row) => Math.max(m, Math.abs(row.amount)), 0)
  const total = rows.reduce((sum, row) => sum + row.amount, 0)

  if (rows.length === 0) return <p className="settings-hint">Nothing in this range.</p>

  return (
    <ul className="settings-list">
      {rows.map((row) => (
        <li key={row.name} className="settings-list__item report-category-row">
          <div className="report-category-row__main">
            <CategoryTag name={row.name} categories={categories} />
            <div className="report-category-row__amounts">
              <span className={`money money--${tone}`}>{formatMoney(row.amount)}</span>
              <span className="settings-list__meta">avg {formatMoney(row.avgPerMonth)}/mo</span>
            </div>
          </div>
          <CategoryBar row={row} max={max} />
        </li>
      ))}
      <li className="settings-list__item report-category-row">
        <div className="report-category-row__main">
          <strong>Total</strong>
          <span className={`money money--${tone}`}>{formatMoney(total)}</span>
        </div>
      </li>
    </ul>
  )
}

function ExportButton({ filename, header, rows }) {
  return (
    <button type="button" onClick={() => downloadCsv(filename, [header, ...rows])}>
      Export CSV
    </button>
  )
}

export default function Reports() {
  const [transactions] = usePersistedState('transactions', [])
  const [categories] = usePersistedState('categories', DEFAULT_CATEGORIES)
  const [accounts] = usePersistedState('accounts', DEFAULT_ACCOUNTS)
  const [invoices] = usePersistedState('invoices', [])

  const today = todayISO()
  const expenseCategories = useMemo(
    () => categories.filter((category) => category.type === 'expense' && !category.archived),
    [categories]
  )
  const [trendCategory, setTrendCategory] = useState(() => expenseCategories[0]?.name || '')

  const availableMonths = useMemo(() => {
    const keys = transactions.map((txn) => monthKey(txn.date)).filter(Boolean)
    const todayKey = monthKey(today)
    const all = keys.length ? [...keys, todayKey] : [todayKey]
    const min = all.reduce((a, b) => (a < b ? a : b))
    const max = all.reduce((a, b) => (a > b ? a : b))
    return monthKeysInRange(min, max)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [rangeStart, setRangeStart] = useState(() => availableMonths[0])
  const [rangeEnd, setRangeEnd] = useState(() => availableMonths[availableMonths.length - 1])
  const [selectedLedgers, setSelectedLedgers] = useState(() => new Set(LEDGER_OPTIONS.map((l) => l.id)))
  const [selectedCategories, setSelectedCategories] = useState(null) // null = all categories

  const activeCategoriesList = useMemo(() => categories.filter((c) => !c.archived), [categories])

  function toggleLedger(id) {
    setSelectedLedgers((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleCategory(name) {
    setSelectedCategories((prev) => {
      const current = prev === null ? new Set(activeCategoriesList.map((c) => c.name)) : new Set(prev)
      if (current.has(name)) current.delete(name)
      else current.add(name)
      return current
    })
  }

  function applyPreset(months) {
    const endKey = availableMonths[availableMonths.length - 1]
    const keys = lastNMonthKeys(`${endKey}-01`, months)
    setRangeStart(keys[0])
    setRangeEnd(endKey)
  }

  function applyAllTime() {
    setRangeStart(availableMonths[0])
    setRangeEnd(availableMonths[availableMonths.length - 1])
  }

  const rangeReport = useMemo(
    () =>
      customRangeReport(transactions, categories, {
        startMonth: rangeStart,
        endMonth: rangeEnd,
        ledgers: Array.from(selectedLedgers),
        categoryNames: selectedCategories === null ? null : Array.from(selectedCategories)
      }),
    [transactions, categories, rangeStart, rangeEnd, selectedLedgers, selectedCategories]
  )

  const cashFlow = useMemo(() => cashFlowSeries(transactions, { months: 12, today }), [transactions, today])
  const trend = useMemo(
    () => (trendCategory ? categoryTrend(transactions, trendCategory, { months: 12, today }) : []),
    [transactions, trendCategory, today]
  )
  const variance = useMemo(() => monthOverMonthVariance(transactions, { today }), [transactions, today])
  const ytd = useMemo(() => ytdRange(today.slice(0, 7)), [today])
  const byStream = useMemo(() => incomeByStream(transactions, categories, ytd), [transactions, categories, ytd])
  const byClient = useMemo(() => incomeByClient(transactions, ytd), [transactions, ytd])
  const pnl = useMemo(() => lhProfitAndLoss(transactions, invoices, categories, ytd), [transactions, invoices, categories, ytd])
  const cashPosition = useMemo(() => totalCashPosition(accounts, transactions), [accounts, transactions])
  const runway = useMemo(() => runwayMonths(cashPosition, transactions, { months: 3, today }), [cashPosition, transactions, today])

  return (
    <div className="screen">
      <h1>Reports</h1>

      <section className="settings-section">
        <h2>Custom range</h2>
        <p className="settings-hint">Pick a date range, ledgers, and categories — everything below updates live.</p>

        <div className="report-filters">
          <div className="report-filters__row">
            <Field label="From">
              <select value={rangeStart} onChange={(event) => setRangeStart(event.target.value)}>
                {availableMonths.map((key) => (
                  <option key={key} value={key}>
                    {monthLabel(key)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="To">
              <select value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)}>
                {availableMonths.map((key) => (
                  <option key={key} value={key}>
                    {monthLabel(key)}
                  </option>
                ))}
              </select>
            </Field>
            <span className="settings-hint">{rangeReport.monthCount} month{rangeReport.monthCount === 1 ? '' : 's'}</span>
          </div>
          <div className="chip-row">
            <Chip label="Last 3 mo" onClick={() => applyPreset(3)} />
            <Chip label="Last 6 mo" onClick={() => applyPreset(6)} />
            <Chip label="Last 12 mo" onClick={() => applyPreset(12)} />
            <Chip label="All time" onClick={applyAllTime} />
          </div>
        </div>

        <h3>Ledgers</h3>
        <div className="chip-row">
          {LEDGER_OPTIONS.map((option) => (
            <Chip
              key={option.id}
              label={option.label}
              active={selectedLedgers.has(option.id)}
              onClick={() => toggleLedger(option.id)}
            />
          ))}
        </div>

        <h3>Categories</h3>
        <div className="chip-row">
          <Chip label="Show all" onClick={() => setSelectedCategories(null)} />
          <Chip label="Deselect all" onClick={() => setSelectedCategories(new Set())} />
          {activeCategoriesList.map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              active={selectedCategories === null || selectedCategories.has(category.name)}
              onClick={() => toggleCategory(category.name)}
            />
          ))}
        </div>

        <div className="dashboard-cards">
          <Card title="Net income">
            <Stat value={formatMoney(rangeReport.summary.netIncome)} tone="income" />
            <span className="settings-hint">avg {formatMoney(rangeReport.summary.netIncome / rangeReport.monthCount)}/mo</span>
          </Card>
          <Card title="Total expenses">
            <Stat value={formatMoney(rangeReport.summary.totalExpenses)} tone="expense" />
            <span className="settings-hint">avg {formatMoney(rangeReport.summary.totalExpenses / rangeReport.monthCount)}/mo</span>
          </Card>
          <Card title="Net position">
            <Stat
              value={formatMoney(rangeReport.summary.netPosition)}
              tone={rangeReport.summary.netPosition >= 0 ? 'income' : 'expense'}
            />
            <span className="settings-hint">
              {rangeReport.summary.netPosition >= 0 ? 'surplus' : 'deficit'} · {rangeReport.monthCount} month
              {rangeReport.monthCount === 1 ? '' : 's'}
            </span>
          </Card>
          <Card title="Avg monthly net">
            <Stat
              value={formatMoney(rangeReport.summary.avgMonthlyNet)}
              tone={rangeReport.summary.avgMonthlyNet >= 0 ? 'income' : 'expense'}
            />
            <span className="settings-hint">monthly {rangeReport.summary.avgMonthlyNet >= 0 ? 'surplus' : 'deficit'}</span>
          </Card>
        </div>

        <div className="report-columns">
          <div>
            <h3>Income by category</h3>
            <CategoryAmountList rows={rangeReport.incomeByCategory} tone="income" categories={categories} />
          </div>
          <div>
            <h3>Expenses by category</h3>
            <CategoryAmountList rows={rangeReport.expensesByCategory} tone="expense" categories={categories} />
          </div>
        </div>

        <h3>Month by month</h3>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Net income</th>
                <th>Expenses</th>
                <th>Net position</th>
                <th>vs avg</th>
              </tr>
            </thead>
            <tbody>
              {rangeReport.monthly.map((row) => (
                <tr key={row.month}>
                  <td>{row.label}</td>
                  <td className="money money--income">{formatMoney(row.income)}</td>
                  <td className="money money--expense">{formatMoney(row.expense)}</td>
                  <td className={`money money--${row.net >= 0 ? 'income' : 'expense'}`}>{formatMoney(row.net)}</td>
                  <td className={`money money--${row.vsAvg >= 0 ? 'income' : 'expense'}`}>
                    {row.vsAvg >= 0 ? '+' : ''}
                    {formatMoney(row.vsAvg)} {row.vsAvg >= 0 ? 'above' : 'below'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="settings-section">
        <div className="screen-header">
          <h2>12-month cash flow</h2>
          <ExportButton
            filename="cash-flow.csv"
            header={['Month', 'Income', 'Expense', 'Net']}
            rows={cashFlow.map((row) => [row.month, row.income.toFixed(2), row.expense.toFixed(2), row.net.toFixed(2)])}
          />
        </div>
        <div className="report-chart">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={cashFlow}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" stroke="var(--color-text-muted)" fontSize={12} />
              <YAxis stroke="var(--color-text-muted)" fontSize={12} />
              <Tooltip
                formatter={(value) => formatMoney(value)}
                contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
              <Bar dataKey="income" fill="var(--color-sage)" name="Income" />
              <Bar dataKey="expense" fill="var(--color-terracotta)" name="Expense" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="settings-section">
        <div className="screen-header">
          <h2>Category trend</h2>
          <select value={trendCategory} onChange={(event) => setTrendCategory(event.target.value)}>
            {expenseCategories.map((category) => (
              <option key={category.id} value={category.name}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div className="report-chart">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="label" stroke="var(--color-text-muted)" fontSize={12} />
              <YAxis stroke="var(--color-text-muted)" fontSize={12} />
              <Tooltip
                formatter={(value) => formatMoney(value)}
                contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
              />
              <Line type="monotone" dataKey="amount" stroke="var(--color-teal)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="settings-section">
        <div className="screen-header">
          <h2>Month-over-month variance</h2>
          <ExportButton
            filename="mom-variance.csv"
            header={['Category', 'Previous month', 'Current month', 'Delta', 'Delta %']}
            rows={variance.map((row) => [row.category, row.previous.toFixed(2), row.current.toFixed(2), row.delta.toFixed(2), row.deltaPct ?? ''])}
          />
        </div>
        {variance.length === 0 ? (
          <p className="settings-hint">Not enough data yet.</p>
        ) : (
          <ul className="settings-list">
            {variance.slice(0, 10).map((row) => (
              <li key={row.category} className="settings-list__item">
                <span>{row.category}</span>
                <span className="settings-list__meta">
                  {formatMoney(row.previous)} → {formatMoney(row.current)}
                </span>
                <span className={`money money--${row.delta >= 0 ? 'expense' : 'income'}`}>
                  {row.delta >= 0 ? '+' : ''}
                  {formatMoney(row.delta)}
                  {row.deltaPct != null ? ` (${row.deltaPct >= 0 ? '+' : ''}${row.deltaPct}%)` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="settings-section">
        <div className="screen-header">
          <h2>Income by stream (YTD)</h2>
          <ExportButton filename="income-by-stream.csv" header={['Stream', 'Amount']} rows={byStream.map((row) => [row.label, row.amount.toFixed(2)])} />
        </div>
        <ul className="settings-list">
          {byStream.map((row) => (
            <li key={row.stream} className="settings-list__item">
              <span>{row.label}</span>
              <span className="money money--income">{formatMoney(row.amount)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-section">
        <div className="screen-header">
          <h2>Income by client (YTD)</h2>
          <ExportButton filename="income-by-client.csv" header={['Client', 'Amount']} rows={byClient.map((row) => [row.client, row.amount.toFixed(2)])} />
        </div>
        <ul className="settings-list">
          {byClient.map((row) => (
            <li key={row.client} className="settings-list__item">
              <span>{row.client}</span>
              <span className="money money--income">{formatMoney(row.amount)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-section">
        <div className="screen-header">
          <h2>Leaf & Hook P&L (YTD)</h2>
          <ExportButton
            filename="lh-pnl.csv"
            header={['Line', 'Amount']}
            rows={[
              ['Revenue (ex-VAT)', pnl.revenue.toFixed(2)],
              ['Production costs', pnl.productionCosts.toFixed(2)],
              ['Opex', pnl.opex.toFixed(2)],
              ['Net', pnl.net.toFixed(2)]
            ]}
          />
        </div>
        <ul className="settings-list">
          <li className="settings-list__item">
            <span>Revenue (ex-VAT)</span>
            <span className="money money--income">{formatMoney(pnl.revenue)}</span>
          </li>
          <li className="settings-list__item">
            <span>Production costs</span>
            <span className="money money--expense">{formatMoney(pnl.productionCosts)}</span>
          </li>
          <li className="settings-list__item">
            <span>Opex</span>
            <span className="money money--expense">{formatMoney(pnl.opex)}</span>
          </li>
          <li className="settings-list__item">
            <span>Net</span>
            <span className={`money money--${pnl.net >= 0 ? 'income' : 'expense'}`}>{formatMoney(pnl.net)}</span>
          </li>
        </ul>
      </section>

      <Card title="Runway">
        {runway == null ? (
          <p className="settings-hint">Cash flow is break-even or positive over the last 3 months — no runway concern.</p>
        ) : (
          <>
            <span className="money money--expense">{runway} months</span>
            <p className="settings-hint">Current cash position ÷ average monthly burn over the last 3 months.</p>
          </>
        )}
      </Card>
    </div>
  )
}
