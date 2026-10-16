import React, { useEffect } from 'react'

const NOTE_MAX = 200

const PLACEHOLDER = {
  A: 'Reason for absence (optional)',
  L: 'Reason for being late (optional)',
  P: 'Add a note (optional)'
}

// Bottom sheet for one lesson: "attended online" switch (P / L only) and a short note
export default function NoteSheet({ lessonLabel, status, online, comment, onOnlineChange, onCommentChange, onClose }) {
  // Esc closes the sheet and the page behind doesn't scroll while it is open
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    const previousOverflow = document.body.style.overflow
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Lesson note"
        onClick={e => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-title">{lessonLabel}</div>

        {status !== 'A' && (
          <div className="sheet-row">
            <span>Attended online</span>
            <button
              type="button"
              role="switch"
              aria-checked={online}
              aria-label="Attended online"
              className={`switch ${online ? 'on' : ''}`}
              onClick={() => onOnlineChange(!online)}
            />
          </div>
        )}

        <textarea
          className="sheet-input"
          rows={4}
          maxLength={NOTE_MAX}
          placeholder={PLACEHOLDER[status] || PLACEHOLDER.P}
          value={comment}
          onChange={e => onCommentChange(e.target.value)}
        />
        <div className="sheet-count">{comment.length}/{NOTE_MAX}</div>

        <button type="button" className="submit-btn" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  )
}