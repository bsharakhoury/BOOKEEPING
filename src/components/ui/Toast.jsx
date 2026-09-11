import { createContext, useCallback, useContext, useRef, useState } from 'react'

const ToastContext = createContext(null)

const DEFAULT_DURATION = 6000

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast(null)
  }, [])

  const showToast = useCallback(
    (message, { actionLabel, onAction, duration = DEFAULT_DURATION } = {}) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      setToast({ message, actionLabel, onAction })
      timerRef.current = setTimeout(dismiss, duration)
    },
    [dismiss]
  )

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {toast && (
        <div className="toast" role="status">
          <span>{toast.message}</span>
          {toast.actionLabel && (
            <button
              className="toast__action"
              onClick={() => {
                toast.onAction?.()
                dismiss()
              }}
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
