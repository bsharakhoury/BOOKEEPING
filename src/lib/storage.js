import { useEffect, useRef, useState } from 'react'

const PREFIX = 'mf:'
const DEBOUNCE_MS = 250

function prefixedKeys() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const fullKey = localStorage.key(i)
    if (fullKey && fullKey.startsWith(PREFIX)) keys.push(fullKey)
  }
  return keys
}

function readRaw(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

function writeRaw(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
    window.dispatchEvent(new CustomEvent('mf:write', { detail: { key } }))
  } catch {
    // storage unavailable or quota exceeded — fail silently, in-memory state still works
  }
}

export function getItem(key, fallback) {
  const value = readRaw(key)
  return value === null ? fallback : value
}

export function setItem(key, value) {
  writeRaw(key, value)
}

export function removeItem(key) {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // ignore
  }
}

export function usePersistedState(key, initial) {
  const [state, setState] = useState(() => getItem(key, initial))
  const timerRef = useRef(null)
  const isFirstRun = useRef(true)

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      writeRaw(key, state)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, state])

  return [state, setState]
}

export function exportAll() {
  const data = {}
  prefixedKeys().forEach((fullKey) => {
    const key = fullKey.slice(PREFIX.length)
    data[key] = readRaw(key)
  })
  return data
}

export function restoreSnapshot(data, mode = 'replace') {
  if (mode === 'replace') {
    prefixedKeys().forEach((fullKey) => {
      try {
        localStorage.removeItem(fullKey)
      } catch {
        // ignore
      }
    })
  }

  Object.entries(data).forEach(([key, value]) => {
    writeRaw(key, value)
  })
}

export async function importAll(file, mode = 'merge') {
  const text = await file.text()
  const parsed = JSON.parse(text)
  restoreSnapshot(parsed, mode)
  return parsed
}

export function clearAll() {
  prefixedKeys().forEach((fullKey) => {
    try {
      localStorage.removeItem(fullKey)
    } catch {
      // ignore
    }
  })
}
