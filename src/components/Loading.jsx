import React from 'react'

// Purple spinner; the label is only read aloud by screen readers
export default function Loading({ label = 'Loading attendance records...', className = '' }) {
  return (
    <div className={`loading ${className}`.trim()} role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  )
}