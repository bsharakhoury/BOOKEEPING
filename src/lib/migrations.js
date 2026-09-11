import { getItem, setItem } from './storage.js'
import { DEFAULT_CATEGORIES } from '../data/categories.js'
import { DEFAULT_ACCOUNTS } from '../data/accounts.js'

export const SCHEMA_VERSION = 2

const DEFAULT_COLLECTIONS = {
  transactions: [],
  subscriptions: [],
  invoices: [],
  debts: [],
  savingsEntries: [],
  savingsGoals: [],
  merchantRules: [],
  vatAdjustments: [],
  importBatches: [],
  settings: { rent: 12500, rentCycleMonths: 3, fx: { USD: 3.674, EUR: 4.02, GBP: 4.73 }, theme: 'system', vatTrn: '', notes: '' }
}

// Ordered, idempotent: each migration only ever moves the store forward from
// its own version - 1 to its version, so re-running on an up-to-date store is a no-op.
const migrations = [
  {
    version: 1,
    run: () => {
      Object.entries(DEFAULT_COLLECTIONS).forEach(([key, defaultValue]) => {
        if (getItem(key, undefined) === undefined) {
          setItem(key, defaultValue)
        }
      })
    }
  },
  {
    version: 2,
    run: () => {
      if (getItem('categories', undefined) === undefined) {
        setItem('categories', DEFAULT_CATEGORIES)
      }
      if (getItem('accounts', undefined) === undefined) {
        setItem('accounts', DEFAULT_ACCOUNTS)
      }
    }
  }
]

// Call before runMigrations() — once migrations run, schemaVersion is no longer 0.
export function isFirstRun() {
  return getItem('schemaVersion', 0) === 0
}

export function runMigrations() {
  const currentVersion = getItem('schemaVersion', 0)
  if (currentVersion >= SCHEMA_VERSION) return currentVersion

  migrations
    .filter((migration) => migration.version > currentVersion)
    .sort((a, b) => a.version - b.version)
    .forEach((migration) => {
      migration.run()
      setItem('schemaVersion', migration.version)
    })

  return SCHEMA_VERSION
}
