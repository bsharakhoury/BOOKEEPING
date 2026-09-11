# My Financials — build brief for Claude Code

You are rebuilding "My Financials", a personal + business finance web app for Bechara El Khoury (Dubai). It replaces an older React app that lost features across many rewrites. Build it from scratch in this folder, following this file exactly. Work phase by phase; finish and verify each phase before starting the next.

## Owner and money context

- Owner: Bechara El Khoury. Currency AED. Two worlds of money:
  - **Personal** — Mashreq Bank (Debit card 9437, Credit card 8777, account transfers), cash.
  - **Leaf & Hook FZ LLC** — RAK Bank starter account, Stripe. VAT-registered (5 %). VAT periods: Mar–May (due 29 Jun), Jun–Aug (due 28 Sep), Sep–Nov (due 29 Dec), Dec–Feb (due 29 Mar).
- Salary comes from an employer ("Beno"). Other income: Leaf & Hook filmmaking, wellness, music/sound, media, license revenue; Prana Harmony; freelance film/wellness/other; refunds, transfers, bank bonus.
- Rent is 12,500 AED every 3 months → 4,166.67/month reserve.
- FX rates for imported foreign transactions: USD 3.674, EUR 4.02, GBP 4.73 (editable in Settings).

## Stack (do not deviate)

- Vite + React 18, JavaScript (no TypeScript), functional components + hooks only.
- `recharts` for charts. `vitest` for tests. No other UI library.
- Storage: browser `localStorage` behind one module (`src/lib/storage.js`). No backend.
- Deploy target: GitHub Pages. `vite.config.js` must have `base: '/My-Financials/'`. Must work as a PWA (manifest + service worker) on iPhone Safari.
- Fonts: Inter (body), Playfair Display (headings), JetBrains Mono (money). Load them in `index.html`.

## Hard rules (apply in every task)

1. Never use `window.confirm` or `window.alert` — they fail silently on GitHub Pages. Use the in-app ConfirmInline + Undo toast.
2. Never define a React component inside another component's body.
3. Never call `localStorage` outside `src/lib/storage.js`.
4. Any change to a stored data shape → add a migration in `src/lib/migrations.js` and bump `SCHEMA_VERSION`.
5. Any parser rule → a fixture + test in `tests/`.
6. Write real Unicode characters (– — · →), not escape sequences.
7. Every destructive action: two-step inline confirm, then a 6-second Undo toast.
8. After every task: `npm run build` and `npm test` must pass. Bump `APP_VERSION` in `package.json`, add a line to `CHANGELOG.md`, then give a short summary and manual test steps.

## File layout

```
src/
  main.jsx  App.jsx  styles.css  theme.js
  lib/
    storage.js      usePersistedState(key, initial) with 250 ms debounced write; exportAll(); importAll(file, 'merge'|'replace')
    migrations.js   SCHEMA_VERSION + ordered idempotent migrations run on app start
    money.js dates.js fx.js
    derive/totals.js vat.js reports.js subscriptions.js debt.js
    parsers/index.js mashreqSms.js rakStatement.js rakCsv.js stripeCsv.js merchants.js categorise.js
  data/categories.js accounts.js vatPeriods.js
  components/ui/  Modal Toast ConfirmInline Card Stat Chip Bar Field Table ErrorBoundary
  components/screens/ Dashboard Transactions Income Business Invoices Vat Subscriptions Debt Savings Reports Duplicates Settings
  components/import/ ImportBox ImportPreview
public/seed/transactions.json  subscriptions.json  (empty arrays if none provided)
tests/*.test.js  tests/fixtures/
```

## Data model

```js
// transaction
{ id, date:'YYYY-MM-DD', merchant, rawMerchant, category, ledger, amount /*positive AED*/,
  type:'expense'|'income'|'transfer'|'refund', paymentMethod /*account name*/,
  currency:'AED', fxRate, fxAmount, bankRef, notes, source:'manual'|'sms'|'csv'|'seed',
  tags:[], linkedInvoiceId, linkedDebtId, linkedSubId, inputVat, reclaimable, docType,
  installment:{ endMonth, remaining }, importBatchId, createdAt, updatedAt }
// ledger: 'personal' | 'business' (Mashreq business spend) | 'lh_business' (Leaf & Hook) | 'income'
// transfers are excluded from every income/expense total. refunds reduce the category they refund.

// category
{ id, name, ledger, group, type:'expense'|'income', stream, color, budget, isCustom, archived }
// stream (income only): 'salary'|'lh_media'|'lh_wellness'|'freelance'|'other'

// account
{ id, name, bank, kind:'debit'|'credit'|'business'|'cash'|'gateway', last4, openingBalance, openingDate, color }

// subscription
{ id, name, category, ledger /*personal|business|lh_business*/, amount, frequency:'monthly'|'quarterly'|'biannual'|'yearly',
  dayOfMonth, nextDue, lastDue, paidOn:[], bank, active, trialEnds, notes }

// invoice
{ id, number:'LH-INV-###', client, project, issueDate, dueDate, currency, fxRate,
  lines:[{ description, qty, unitPrice, vatTreatment:'standard'|'zero'|'exempt'|'out_of_scope' }],
  payments:[{ date, amount, method, txnId, kind:'down'|'second'|'final'|'full'|'refund' }],
  notes, docLink }   // subtotal, vatAmount, total, remaining, status, vatPeriod are COMPUTED, never stored

// debt
{ id, name, type, scope:'Personal'|'Business', lender, original, remaining, interest, monthlyMin,
  payments:[{ date, amount, txnId, isSettlement, savedAmount }], status:'active'|'settled', notes }

// savings entry { id, date, amount, label, notes }   goal { id, name, target, current, targetDate, notes }
// settings { rent:12500, rentCycleMonths:3, fx:{USD:3.674,EUR:4.02,GBP:4.73}, theme, vatTrn, notes }
// merchantRules [{ match /*string or regex*/, merchant, category, ledger }]
// vatAdjustments [{ period, kind:'output'|'input', amount, vat, description }]
```

### Default categories

- Personal expense: Food (Groceries), Food (Eating Out), Transport (Public/Taxi), Transport (Fuel), Transport (Car Rental), Utilities, Personal utilities, Personal subscription, Personal care, Personal expenses, Mental / Therapy, Socializing, Home, Rent, Debt payment, Cash Withdrawal
- Business (Mashreq): Business subscription, Business expenses, Office / Workspace, Software / Tools, Marketing, Travel (Business)
- Leaf & Hook: LH – Production Costs, LH – Supplier Payment, LH – Bank Fees, LH – Legal / Accounting, LH – Travel, LH – Equipment, LH – Marketing, LH – VAT, LH – Other
- Income (stream in brackets): Salary – Beno (salary); Leaf & Hook – Filmmaking, – Music / Sound, – Media, – License Revenue (lh_media); Leaf & Hook – Wellness, Prana Harmony (lh_wellness); Freelance Film, Freelance Wellness, Freelance Other (freelance); Bank Bonus, Transfer In, Refund, Other Income (other)

### Default accounts

Mashreq Debit 9437 (debit) · Mashreq Credit 8777 (credit) · Mashreq Transfer (debit) · RAK Bank (business, default ledger lh_business) · Stripe (gateway) · Cash

## Import engine — rules that must each have a test

Paste box + `.csv` upload → `detect()` picks the parser → ImportPreview (editable category/ledger/account per row, duplicate flag, skip / add anyway, "remember this merchant" → merchantRules) → commit with `importBatchId` (Settings can undo a whole batch).

Mashreq SMS formats to support: debit card purchase (`P_MASHREQ_DEBIT`), Neo Visa credit card (`P_NEO_VISA`), account credit/debit (`P_ACCOUNT`), Aani transfers, salary credit. Each line may contain "Available Balance …" — never read that number as the amount. Dates may be in-sentence ("on Monday, 10 August 2026, 1:26 pm") or given once as a header and apply to following lines.

Rules:
- Aani debited → expense (ledger personal, category Personal expenses unless a merchant rule says otherwise). Aani credited → income, Transfer In.
- Foreign currency amount → convert with Settings FX rate; store `currency`, `fxRate`, `fxAmount`.
- "MAJID AL FUTTAIM HM" → merchant Carrefour → Food (Groceries).
- Stripe payout to bank → `transfer`. Stripe CSV sessions → income Leaf & Hook – Wellness, fee → LH – Bank Fees.
- RAK CSV (`Account_Transactions_CSV*.csv`): header block, then rows `[ , postDate dd/mm/yyyy, , valueDate, ref, , description(multiline), cardOrRef, memo, debit, credit, balance]`. Debit column → expense, credit column → income; `PURCHASE TRXN.-REV` → refund; `CHARGE COLLECTION … INCL VAT` and `RAKvalue Monthly Fee` → LH – Bank Fees with `inputVat = amount − amount/1.05`, `reclaimable: true`; `OUTWARD T/T … Federal tax authority` → LH – VAT (excluded from P&L expenses).
- Duplicates: match on `bankRef` first, else `date|amount|rawMerchant`.
- Yearly subscriptions never count in monthly totals.

## Screens

- **Dashboard**: month selector + Month/Quarter/YTD; hero = net this month; cards Income · Personal · Business · Cash position (Σ account balances) · Upcoming 14 days (subs, debt minimums, rent reserve) · VAT accrued and days to deadline; per-category budget bars; "Needs attention" (uncategorised imports, overdue invoices, subs due ≤ 3 days, duplicates, VAT due ≤ 21 days); recent activity.
- **Transactions**: one screen, ledger chips (Personal · Mashreq business · L&H · Income · Transfers), month chips, search with `cat:` `acct:` `tag:` `>500` operators, category filter, bulk select → recategorise/retag/delete, split transaction, edit modal, running balance per account.
- **Income**: buckets by `stream`, month table, income by client (`client:` tag), link row → invoice.
- **Business (L&H)**: business expenses (RAK + Mashreq business), month table, quick access to Invoices and VAT.
- **Invoices**: auto-number, lines, payments log, computed status, "Expected payments" view with 7-day highlight, client totals, print-friendly single-invoice view.
- **VAT**: derived per period — output from invoice lines by treatment, input from `lh_business` rows with `reclaimable && docType === 'Tax Invoice'`; FTA box layout; net payable; adjustments; "Export period CSV" with columns `No., Date, Invoice No., Client/Supplier Name, Taxable Amount, Tax, Total`.
- **Subscriptions**: three ledgers; nextDue auto-rolls forward on load; match paid transactions → "Paid ✓ date"; price-change flag > 5 %; annual cost view; installments (from transactions with `installment.endMonth`).
- **Debt**: edit, payments log, settlements, payoff projection, avalanche/snowball with extra-payment slider, link Debt-payment transactions.
- **Savings**: entries, goals with target date and required monthly, rent reserve goal fed from settings, emergency fund = 3 × rolling essential average.
- **Reports**: 12-month cash-flow chart, category trend, MoM variance, income by stream/client, L&H P&L (revenue ex-VAT, production costs, opex, net), runway; CSV export on every table.
- **Duplicates**: exact and fuzzy detection, keep-one actions, ignore group.
- **Settings**: accounts, categories (rename rewrites transactions, budgets, colours), FX, rent, VAT TRN, merchant rules, import batches (undo), Export JSON / Import JSON (merge or replace, with count preview), typed "RESET" to clear, theme, schema + app version.

## Design

- Palette: navy #1C2940, sage #4A7C59, teal #2E8B8B, terracotta #C0522A, amber #C08B2A, violet #6B4FA0, ink #1C1F1A, background #F5F4EF, white #FDFDF8, border #D8D6CE. Put these in CSS variables in `styles.css`; add a dark theme (`prefers-color-scheme` + manual toggle). Components use classes, not inline style objects.
- Money in JetBrains Mono with `font-variant-numeric: tabular-nums`. Expense = ink, income = sage, transfer = faint, refund = teal.
- Navigation: < 900 px bottom bar with 5 tabs (Dashboard, Transactions, Income, Business, More → sheet with Subs, Debt, Savings, Reports, Duplicates, Settings); ≥ 900 px left sidebar with every screen.
- Touch targets ≥ 44 px. Empty states with one primary action. Keyboard: `n` new entry, `/` search, `Esc` close.

## Phases — do them in this order, one per session

1. **Scaffold**: Vite project, layout above, storage.js, migrations.js, ErrorBoundary, theme + CSS vars + fonts, nav shell with empty screens, vitest with one test, PWA manifest, `base` set. Build + test green.
2. **Core records**: Transactions screen (add/edit/delete with confirm + undo, filters, search), categories + accounts data and Settings for both, Export/Import JSON, typed RESET, seed loading from `public/seed/*.json` on first run.
3. **Import engine**: all parsers with fixtures and tests, ImportPreview, merchant rules, batch undo, CSV upload.
4. **Income, Subscriptions, Savings, Debt** screens per spec.
5. **Invoices + VAT** per spec, including period CSV export.
6. **Dashboard + Reports** per spec, with recharts.
7. **Polish**: dark mode, keyboard shortcuts, virtualised list when > 500 rows, PWA offline check on iPhone.

Start with Phase 1 now. Before writing code, list the files you will create; then create them; then run build and test.
