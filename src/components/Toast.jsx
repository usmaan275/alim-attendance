import React from 'react'

// Small in-app message (replaces alert(), which iOS Safari can silently block)
export default function Toast({ message, type = 'info' }) {
  return (
    <div className={`toast ${type}`} role={type === 'error' ? 'alert' : 'status'}>
      {message}
    </div>
  )
}