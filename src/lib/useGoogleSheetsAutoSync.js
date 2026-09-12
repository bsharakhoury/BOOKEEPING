import { useEffect, useRef } from 'react'
import { getItem, setItem } from './storage.js'
import { pushTransactionsToSheet, requestAccessToken } from './googleSheetsSync.js'

const DEBOUNCE_MS = 5000

// Listens for any write to the 'transactions' key (from whichever screen made it — Transactions,
// import, legacy import, Duplicates, etc. all funnel through storage.js) and, if Google Sheets
// sync is connected, pushes the current transaction list after a short debounce. Runs once at
// the app shell level so it works no matter which screen is mounted.
export function useGoogleSheetsAutoSync() {
  const timerRef = useRef(null)

  useEffect(() => {
    function scheduleSync() {
      const settings = getItem('settings', {})
      const gs = settings.googleSheets
      if (!gs?.connected || !gs.clientId || !gs.sheetId) return

      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(async () => {
        try {
          const token = await requestAccessToken(gs.clientId, { silent: true })
          const transactions = getItem('transactions', [])
          await pushTransactionsToSheet({ accessToken: token, sheetId: gs.sheetId, transactions })
          const latest = getItem('settings', {})
          setItem('settings', { ...latest, googleSheets: { ...latest.googleSheets, lastSyncedAt: new Date().toISOString() } })
        } catch {
          const latest = getItem('settings', {})
          setItem('settings', { ...latest, googleSheets: { ...latest.googleSheets, connected: false } })
        }
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
