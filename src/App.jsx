import { useEffect, useMemo, useState } from 'react'
import { ErrorBoundary } from './components/ui/ErrorBoundary.jsx'
import { ToastProvider } from './components/ui/Toast.jsx'
import { isFirstRun, runMigrations } from './lib/migrations.js'
import { getItem } from './lib/storage.js'
import { loadSeedOnFirstRun } from './lib/seed.js'
import { RemountContext } from './lib/remountContext.js'
import { applyTheme } from './theme.js'

import Dashboard from './components/screens/Dashboard.jsx'
import Transactions from './components/screens/Transactions.jsx'
import Income from './components/screens/Income.jsx'
import Business from './components/screens/Business.jsx'
import Invoices from './components/screens/Invoices.jsx'
import Vat from './components/screens/Vat.jsx'
import Subscriptions from './components/screens/Subscriptions.jsx'
import Debt from './components/screens/Debt.jsx'
import Savings from './components/screens/Savings.jsx'
import Reports from './components/screens/Reports.jsx'
import Duplicates from './components/screens/Duplicates.jsx'
import Settings from './components/screens/Settings.jsx'

const PRIMARY_TABS = [
  { id: 'dashboard', label: 'Dashboard', Component: Dashboard },
  { id: 'transactions', label: 'Transactions', Component: Transactions },
  { id: 'income', label: 'Income', Component: Income },
  { id: 'business', label: 'Business', Component: Business }
]

const MORE_ITEMS = [
  { id: 'subscriptions', label: 'Subscriptions', Component: Subscriptions },
  { id: 'debt', label: 'Debt', Component: Debt },
  { id: 'savings', label: 'Savings', Component: Savings },
  { id: 'reports', label: 'Reports', Component: Reports },
  { id: 'duplicates', label: 'Duplicates', Component: Duplicates },
  { id: 'settings', label: 'Settings', Component: Settings }
]

const SECONDARY_ITEMS = [
  { id: 'invoices', label: 'Invoices', Component: Invoices },
  { id: 'vat', label: 'VAT', Component: Vat }
]

const SIDEBAR_ITEMS = [...PRIMARY_TABS, ...SECONDARY_ITEMS, ...MORE_ITEMS]

function App({ screenId, onSelectScreen, onRequestRemount = () => {} }) {
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    const firstRun = isFirstRun()
    runMigrations()
    if (firstRun) loadSeedOnFirstRun(true)
    const settings = getItem('settings', { theme: 'system' })
    applyTheme(settings.theme || 'system')
  }, [])

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        setMoreOpen(false)
        return
      }

      const target = event.target
      const isEditable =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
      if (isEditable) return

      if (event.key === '/') {
        const searchField = document.querySelector('[data-shortcut="search"]')
        if (searchField) {
          event.preventDefault()
          searchField.focus()
        }
        return
      }

      if (event.key === 'n') {
        const newButton = document.querySelector('[data-shortcut="new"]')
        if (newButton) {
          event.preventDefault()
          newButton.click()
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  const screenMap = useMemo(() => {
    const map = {}
    SIDEBAR_ITEMS.forEach((item) => {
      map[item.id] = item
    })
    return map
  }, [])

  const ActiveScreen = screenMap[screenId]?.Component ?? Dashboard
  const isMoreActive = MORE_ITEMS.some((item) => item.id === screenId)

  function selectScreen(id) {
    onSelectScreen(id)
    setMoreOpen(false)
  }

  return (
    <ErrorBoundary>
      <ToastProvider>
        <RemountContext.Provider value={onRequestRemount}>
          <div className="app-shell">
            <nav className="sidebar" aria-label="Primary">
              {SIDEBAR_ITEMS.map((item) => (
                <button
                  key={item.id}
                  className="sidebar__item"
                  aria-current={screenId === item.id ? 'page' : undefined}
                  onClick={() => selectScreen(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <main className="app-main">
              <ActiveScreen />
            </main>

            <nav className="bottom-nav" aria-label="Primary">
              {PRIMARY_TABS.map((item) => (
                <button
                  key={item.id}
                  className="bottom-nav__item"
                  aria-current={screenId === item.id ? 'page' : undefined}
                  onClick={() => selectScreen(item.id)}
                >
                  {item.label}
                </button>
              ))}
              <button
                className="bottom-nav__item"
                aria-current={isMoreActive ? 'page' : undefined}
                onClick={() => setMoreOpen(true)}
              >
                More
              </button>
            </nav>

            {moreOpen && (
              <div className="more-sheet" onClick={() => setMoreOpen(false)}>
                <div className="more-sheet__panel" onClick={(event) => event.stopPropagation()}>
                  {MORE_ITEMS.map((item) => (
                    <button key={item.id} className="more-sheet__item" onClick={() => selectScreen(item.id)}>
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </RemountContext.Provider>
      </ToastProvider>
    </ErrorBoundary>
  )
}

export default App
