import { useEffect, useRef } from 'react'
import { getItem, setItem } from './storage.js'
import { forgetAccessToken, getCachedAccessToken, pushTransactionsToSheet } from './googleSheetsSync.js'

const DEBOUNCE_MS = 5000

function updateGoogleSheetsSettings(patch) {
  const latest = getItem('settings', {})
  setItem('settings', { ...latest, googleSheets: { ...latest.googleSheets, ...patch } })
}

// One background sync attempt. It NEVER asks Google for anything: it uses the access token the app
// is already holding from the last time the user clicked Connect / Sync now (valid ~1 hour). With
// no valid token it does nothing but record that the backup is paused — opening a sign-in window
// on every edit was the bug this replaced. Returns what happened, for the caller and for tests.
export async function runAutoSync({
  getSettings = () => getItem('settings', {}),
  getTransactions = () => getItem('transactions', []),
  getToken = getCachedAccessToken,
  push = pushTransactionsToSheet,
  save = updateGoogleSheetsSettings,
  dropToken = forgetAccessToken,
  now = () => new Date().toISOString()
} = {}) {
  const gs = getSettings().googleSheets
  if (!gs?.connected || !gs.clientId || !gs.sheetId) return 'disabled'

  const token = getToken()
  if (!token) {
    save({ needsReconnect: true })
    return 'paused'
  }

  try {
    await push({ accessToken: token, sheetId: gs.sheetId, transactions: getTransactions() })
    save({ lastSyncedAt: now(), needsReconnect: false })
    return 'synced'
  } catch (error) {
    // Only an authorisation failure means the sign-in is no longer good; anything else (offline, a
    // hiccup) just leaves the next edit to try again.
    if (error?.status === 401 || error?.status === 403) {
      dropToken()
      save({ needsReconnect: true })
      return 'paused'
    }
    return 'failed'
  }
}

// Listens for any write to the 'transactions' key (from whichever screen made it — Transactions,
// import, legacy import, Duplicates, etc. all funnel through storage.js) and, if Google Sheets
// sync is connected, pushes the current transaction list after a short debounce. Runs once at
// the app shell level so it works no matter which screen is mounted.
export function useGoogleSheetsAutoSync() {
  const timerRef = useRef(null)

  useEffect(() => {
    function scheduleSync() {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        const outcome = await runAutoSync()
        if (outcome === 'paused') window.dispatchEvent(new CustomEvent('mf:sync-paused'))
      }, DEBOUNCE_MS)
    }

    function handleWrite(event) {
      if (event.detail?.key === 'transactions') scheduleSync()
    }

    window.addEventListener('mf:write', handleWrite)
    return () => {
      window.removeEventListener('mf:write', handleWrite)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])
}
