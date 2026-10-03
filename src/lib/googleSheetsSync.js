const GIS_SRC = 'https://accounts.google.com/gsi/client'
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets'
const SHEET_TAB = 'Transactions'

const HEADER = ['ID', 'Date', 'Merchant', 'Category', 'Ledger', 'Type', 'Amount', 'Account', 'Notes']

let gisLoadPromise = null

// Loads the Google Identity Services script once, lazily — only when the user actually opens
// sync, not on every page load for people who never use this feature.
function loadGis() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Not running in a browser.'))
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gisLoadPromise) return gisLoadPromise

  gisLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load Google Identity Services.'))
    document.head.appendChild(script)
  })
  return gisLoadPromise
}

// The access token lasts about an hour. It is kept in memory only (never stored), so the app can
// keep syncing edits for that hour without asking Google again — and so that automatic syncing
// never has a reason to open a sign-in window.
let cachedToken = null

export function rememberAccessToken(response, now = Date.now()) {
  const lifetimeMs = (Number(response.expires_in) || 3600) * 1000
  cachedToken = { value: response.access_token, expiresAt: now + lifetimeMs }
}

export function getCachedAccessToken(now = Date.now()) {
  // A minute of margin so a token isn't used a moment before it expires mid-request.
  return cachedToken && cachedToken.expiresAt - now > 60_000 ? cachedToken.value : null
}

export function forgetAccessToken() {
  cachedToken = null
}

// Asks Google for an access token. This ALWAYS may open a Google sign-in / account-chooser window
// (the browser-only flow has no truly silent refresh), so it must only ever be called from a
// direct user click — never from background syncing. `consent: true` forces the full permission
// screen (first connect); otherwise Google only asks if it has to.
export async function requestAccessToken(clientId, { consent = false } = {}) {
  await loadGis()
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error))
          return
        }
        rememberAccessToken(response)
        resolve(response.access_token)
      },
      error_callback: (error) => reject(new Error(error?.type || 'Google sign-in failed.'))
    })
    client.requestAccessToken({ prompt: consent ? 'consent' : '' })
  })
}

// Sorted newest-first, one row per transaction — matches how every other screen lists them.
export function transactionsToRows(transactions) {
  const sorted = [...transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  return [
    HEADER,
    ...sorted.map((txn) => [
      txn.id,
      txn.date,
      txn.merchant || '',
      txn.category || '',
      txn.ledger || '',
      txn.type || '',
      txn.amount,
      txn.paymentMethod || '',
      txn.notes || ''
    ])
  ]
}

// Overwrites the whole "Transactions" tab with the current transaction list, so the sheet is
// always an exact mirror — edits and deletes in the app disappear from the sheet too, rather
// than leaving stale rows behind from an append-only log.
export async function pushTransactionsToSheet({ accessToken, sheetId, transactions, fetchImpl = fetch }) {
  const rows = transactionsToRows(transactions)

  const clearRes = await fetchImpl(`${SHEETS_API}/${sheetId}/values/${encodeURIComponent(SHEET_TAB)}!A:Z:clear`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!clearRes.ok) throw Object.assign(new Error(`Could not clear the sheet (HTTP ${clearRes.status}).`), { status: clearRes.status })

  const range = `${SHEET_TAB}!A1`
  const updateRes = await fetchImpl(`${SHEETS_API}/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: rows })
  })
  if (!updateRes.ok) throw Object.assign(new Error(`Could not write to the sheet (HTTP ${updateRes.status}).`), { status: updateRes.status })

  return { rowCount: rows.length - 1 }
}
