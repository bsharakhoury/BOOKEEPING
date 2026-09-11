import { useState } from 'react'

export function ConfirmInline({ label, confirmLabel = 'Confirm', onConfirm, className = '' }) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <span className={`confirm-inline ${className}`}>
        <button
          className="confirm-inline__confirm"
          onClick={() => {
            setConfirming(false)
            onConfirm()
          }}
        >
          {confirmLabel}
        </button>
        <button className="confirm-inline__cancel" onClick={() => setConfirming(false)}>
          Cancel
        </button>
      </span>
    )
  }

  return (
    <button type="button" className={`confirm-inline__trigger ${className}`} onClick={() => setConfirming(true)}>
      {label}
    </button>
  )
}
