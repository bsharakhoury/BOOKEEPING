import { createContext, useContext } from 'react'

// Lets any screen (Settings' Import/Reset) force the whole tree to remount so every
// usePersistedState hook re-reads localStorage, without a full page reload.
export const RemountContext = createContext(() => {})

export function useRemountApp() {
  return useContext(RemountContext)
}
