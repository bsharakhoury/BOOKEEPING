import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Card } from '../ui/Card.jsx'
import { usePersistedState } from '../../lib/storage.js'
import { formatMoney } from '../../lib/money.js'
import { todayISO, ytdRange } from '../../lib/dates.js'
import {
  cashFlowSeries,
  categoryTrend,
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
