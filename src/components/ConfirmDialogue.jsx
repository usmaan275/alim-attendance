import React, { useEffect } from 'react'

// In-app replacement for window.confirm (native dialogs can freeze iOS Safari during back navigation)
export default function ConfirmDialogue({ message, confirmLabel = 'Discard', cancelLabel = 'Stay', onConfirm, onCancel }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="sheet-backdrop" onClick={onCancel}>
      <div
        className="sheet"
        role="alertdialog"
        aria-modal="true"
        aria-label={message}
        onClick={e => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <p className="confirm-text">{message}</p>
        <div className="confirm-actions">
          <button type="button" className="confirm-btn" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className="confirm-btn danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}