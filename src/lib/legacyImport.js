import { periodForMonth } from '../data/vatPeriods.js'

const KNOWN_KEYS = ['txns', 'subs', 'debt', 'invoices', 'budgets', 'savings', 'savingsGoals', 'vatOutput', 'vatInput', 'customCats']
const UNMAPPED_KEYS = ['invoices', 'budgets', 'savingsGoals', 'customCats']
const KNOWN_LEDGERS = ['personal', 'business', 'lh_business', 'income']
const KNOWN_FREQUENCIES = ['monthly', 'quarterly', 'biannual', 'yearly']

// CP1252 only differs from Latin-1 in the 0x80-0x9F range (smart quotes, dashes, etc).
// Above 0x9F it's a direct Unicode code-point map, same as Latin-1.
const CP1252_HIGH = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026,
  0x86: 0x2020, 0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160,
  0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019,
  0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014,
  0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153,
  0x9e: 0x017e, 0x9f: 0x0178
}

function decodeCp1252Byte(byte) {
  if (byte in CP1252_HIGH) return String.fromCodePoint(CP1252_HIGH[byte])
  return String.fromCharCode(byte)
}

// Some old backups were accidentally saved as RTF (pasted into TextEdit) instead of plain
// .json. RTF escapes literal braces as \{ \} and non-ASCII text as \'XX hex bytes — unwrap
// that back to the plain JSON text it started as. Passes non-RTF input through unchanged.
export function unwrapRtfIfNeeded(rawText) {
  const trimmed = String(rawText).trim()
  if (!trimmed.startsWith('{\\rtf1')) return rawText

  const marker = trimmed.indexOf('\\{"')
  if (marker === -1) {
    throw new Error('This looks like an RTF file, but no JSON content could be found inside it.')
  }

  let body = trimmed.slice(marker)
  if (body.endsWith('\\}}')) {
    body = body.slice(0, -1) // drop the RTF document's own trailing closing brace
  }

  let out = ''
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (ch !== '\\') {
      out += ch
      continue
    }
    const next = body[i + 1]
    if (next === '{' || next === '}' || next === '\\') {
      out += next
      i += 1
    } else if (next === "'") {
      out += decodeCp1252Byte(parseInt(body.slice(i + 2, i + 4), 16))
      i += 3
    }
    // any other backslash escape (RTF control words in the header) is dropped
  }
  return out
}

export function parseLegacyBackup(rawText) {
  const jsonText = unwrapRtfIfNeeded(rawText)
  let data
  try {
    data = JSON.parse(jsonText)
  } catch {
    throw new Error('Could not read this as JSON, even after unwrapping RTF.')
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || !KNOWN_KEYS.some((key) => key in data)) {
    throw new Error("This doesn't look like a My Financials legacy backup (expected keys like txns, subs, debt…).")
  }
  return data
}

function slugify(text) {
  const slug = String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'item'
}

// Old data mixed "Category - Name" (hyphen) and "Category – Name" (en dash) for the same
// category, plus a couple of abbreviated/renamed labels. Normalize before matching.
const CATEGORY_ALIASES = {
  'leaf & hook – license': 'Leaf & Hook – License Revenue',
  'other (personal)': 'Personal expenses'
}

function normalizeCategoryName(name) {
  const dashed = String(name).trim().replace(/\s+-\s+/g, ' – ')
  return CATEGORY_ALIASES[dashed.toLowerCase()] || dashed
}

function resolveCategory(rawName, { ledger, type }, ctx) {
  const normalized = normalizeCategoryName(rawName)
  const key = normalized.toLowerCase()

  const existing = ctx.categoryIndex.get(key)
  if (existing) return existing.name

  const category = {
    id: `legacy-cat-${slugify(normalized)}`,
    name: normalized,
    ledger,
    group: 'Imported',
    type,
    stream: type === 'income' ? 'other' : null,
    color: 'var(--color-navy)',
    budget: null,
    isCustom: true,
    archived: false
  }
  ctx.categoryIndex.set(key, category)
  ctx.newCategories.set(key, category)
  return category.name
}

function resolveAccount(rawName, ctx) {
  const trimmed = String(rawName || '').trim()
  if (!trimmed) return null
  const key = trimmed.toLowerCase()

  const existing = ctx.accountIndex.get(key)
  if (existing) return existing.name

  const account = {
    id: `legacy-acct-${slugify(trimmed)}`,
    name: trimmed,
    bank: trimmed,
    kind: 'debit',
    last4: null,
    openingBalance: 0,
    openingDate: null,
    color: 'var(--color-navy)'
  }
  ctx.accountIndex.set(key, account)
  ctx.newAccounts.set(key, account)
  return account.name
}

function mapTransaction(old, ctx) {
  const rawCategory = String(old.category || '').trim()
  const isTransfer = rawCategory.toLowerCase() === 'transfer'
  const type = isTransfer ? 'transfer' : old.type === 'income' ? 'income' : 'expense'
  const ledger = KNOWN_LEDGERS.includes(old.ledger) ? old.ledger : 'personal'

  const category = isTransfer
    ? 'Transfer'
    : resolveCategory(rawCategory || 'Uncategorized (imported)', { ledger, type }, ctx)

  const paymentMethod = resolveAccount(old.paymentMethod, ctx)
  const amount = Number(old.amount) || 0
  const now = new Date().toISOString()

  return {
    id: `legacy-txn-${old.id}`,
    date: old.date,
    merchant: old.merchant || '(no description)',
    rawMerchant: old.merchant || '(no description)',
    category,
    ledger,
    amount,
    type,
    paymentMethod,
    currency: 'AED',
    fxRate: 1,
    fxAmount: amount,
    bankRef: null,
    notes: old.notes || '',
    source: 'seed',
    tags: [],
    linkedInvoiceId: null,
    linkedDebtId: old.debtId ? `legacy-debt-${old.debtId}` : null,
    linkedSubId: null,
    inputVat: old.inputVat ?? null,
    reclaimable: old.vatReclaimable ?? false,
    docType: null,
    installment: null,
    importBatchId: ctx.batchId,
    createdAt: old.createdAt || now,
    updatedAt: now
  }
}

function mapSubscription(old, ctx) {
  const ledger = ['personal', 'business', 'lh_business'].includes(old.ledger) ? old.ledger : 'personal'
  const category = resolveCategory(old.category || 'Personal subscription', { ledger, type: 'expense' }, ctx)
  const bank = resolveAccount(old.bank, ctx)

  return {
    id: `legacy-sub-${old.id}`,
    name: old.name || 'Untitled subscription',
    category,
    ledger,
    amount: Number(old.amount) || 0,
    frequency: KNOWN_FREQUENCIES.includes(old.frequency) ? old.frequency : 'monthly',
    dayOfMonth: old.dayOfMonth ?? null,
    nextDue: old.nextDue || null,
    lastDue: null,
    paidOn: [],
    bank,
    active: old.active !== false,
    trialEnds: null,
    notes: old.notes || ''
  }
}

function mapDebt(old) {
  return {
    id: `legacy-debt-${old.id}`,
    name: old.name || 'Untitled debt',
    type: old.type || '',
    scope: old.scope === 'Business' ? 'Business' : 'Personal',
    lender: old.lender || '',
    original: Number(old.original) || 0,
    remaining: Number(old.remaining) || 0,
    interest: Number(old.interest) || 0,
    monthlyMin: Number(old.monthlyMin) || 0,
    payments: (old.payments || []).map((payment) => ({
      date: payment.date,
      amount: Number(payment.amount) || 0,
      txnId: null,
      isSettlement: !!payment.isSettlement,
      savedAmount: payment.savedAmount ?? null
    })),
    status: old.status === 'settled' ? 'settled' : 'active',
    notes: old.notes || ''
  }
}

function mapSavingsEntry(old) {
  return {
    id: `legacy-sav-${old.id}`,
    date: old.date,
    amount: Number(old.amount) || 0,
    label: old.label || '',
    notes: old.notes || ''
  }
}

function periodIdForDate(date, fallback) {
  const month = date ? Number(String(date).slice(5, 7)) : null
  const period = month ? periodForMonth(month) : null
  return period ? period.id : fallback || 'unknown'
}

function mapVatOutput(old) {
  return {
    period: periodIdForDate(old.date, old.periodLabel),
    date: old.date || null,
    kind: 'output',
    amount: Number(old.netAmount) || 0,
    vat: Number(old.vatAmount) || 0,
    description: [old.client, old.invoiceNo].filter(Boolean).join(' — ') || old.notes || ''
  }
}

function mapVatInput(old) {
  return {
    period: periodIdForDate(old.date, old.periodLabel),
    date: old.date || null,
    kind: 'input',
    amount: Number(old.netAmount) || 0,
    vat: Number(old.inputVat) || 0,
    description: [old.supplier, old.description].filter(Boolean).join(' — ') || old.notes || ''
  }
}

function countRecords(value) {
  if (Array.isArray(value)) return value.length
  if (value && typeof value === 'object') return 1
  return 0
}

export function mapLegacyBackup(oldData, { categories = [], accounts = [] } = {}) {
  const ctx = {
    batchId: `legacy-${Date.now()}`,
    categoryIndex: new Map(categories.map((category) => [category.name.toLowerCase(), category])),
    accountIndex: new Map(accounts.map((account) => [account.name.toLowerCase(), account])),
    newCategories: new Map(),
    newAccounts: new Map()
  }

  const transactions = Array.isArray(oldData.txns) ? oldData.txns.map((txn) => mapTransaction(txn, ctx)) : []
  const subscriptions = Array.isArray(oldData.subs) ? oldData.subs.map((sub) => mapSubscription(sub, ctx)) : []
  const debts = Array.isArray(oldData.debt) ? oldData.debt.map(mapDebt) : []
  const savingsEntries = Array.isArray(oldData.savings) ? oldData.savings.map(mapSavingsEntry) : []
  const vatAdjustments = [
    ...(Array.isArray(oldData.vatOutput) ? oldData.vatOutput.map(mapVatOutput) : []),
    ...(Array.isArray(oldData.vatInput) ? oldData.vatInput.map(mapVatInput) : [])
  ]

  const warnings = UNMAPPED_KEYS.filter((key) => countRecords(oldData[key]) > 0).map(
    (key) => `"${key}" has ${countRecords(oldData[key])} record(s) but isn't mapped yet — skipped.`
  )

  return {
    transactions,
    subscriptions,
    debts,
    savingsEntries,
    vatAdjustments,
    newCategories: Array.from(ctx.newCategories.values()),
    newAccounts: Array.from(ctx.newAccounts.values()),
    warnings,
    counts: {
      transactions: transactions.length,
      subscriptions: subscriptions.length,
      debts: debts.length,
      savingsEntries: savingsEntries.length,
      vatAdjustments: vatAdjustments.length,
      newCategories: ctx.newCategories.size,
      newAccounts: ctx.newAccounts.size
    }
  }
}

export function mergeById(existing, incoming) {
  const map = new Map(existing.map((item) => [item.id, item]))
  incoming.forEach((item) => map.set(item.id, item))
  return Array.from(map.values())
}

export function mergeVatAdjustments(existing, incoming) {
  const key = (adj) => `${adj.period}|${adj.date}|${adj.kind}|${adj.amount}|${adj.vat}|${adj.description}`
  const map = new Map(existing.map((adj) => [key(adj), adj]))
  incoming.forEach((adj) => map.set(key(adj), adj))
  return Array.from(map.values())
}
