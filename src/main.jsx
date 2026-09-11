import { StrictMode, useCallback, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// remountKey lives here (outside App) so Settings' Import/Reset can force every
// usePersistedState hook to re-read localStorage by bumping it, while screenId
// (also here) survives that remount instead of snapping back to the Dashboard.
function Root() {
  const [remountKey, setRemountKey] = useState(0)
  const [screenId, setScreenId] = useState('dashboard')
  const requestRemount = useCallback(() => setRemountKey((key) => key + 1), [])

  return <App key={remountKey} screenId={screenId} onSelectScreen={setScreenId} onRequestRemount={requestRemount} />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
