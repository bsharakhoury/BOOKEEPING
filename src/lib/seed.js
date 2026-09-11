import { setItem } from './storage.js'

const SEED_FILES = {
  transactions: 'transactions.json',
  subscriptions: 'subscriptions.json'
}

async function loadSeedCollection(key, file) {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}seed/${file}`)
    if (!response.ok) return
    const data = await response.json()
    if (Array.isArray(data) && data.length > 0) {
      setItem(key, data)
    }
  } catch {
    // seed files are optional — silently keep the empty defaults from migrations
  }
}

export async function loadSeedOnFirstRun(wasFirstRun) {
  if (!wasFirstRun) return
  await Promise.all(Object.entries(SEED_FILES).map(([key, file]) => loadSeedCollection(key, file)))
}
