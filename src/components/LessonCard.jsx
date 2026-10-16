import React from 'react'
import { getFormattedLessonDate, isFutureLesson } from '../constants'

const STATUS_OPTIONS = [
  { label: 'P', value: 'P', title: 'Present' },
  { label: 'L', value: 'L', title: 'Late' },
  { label: 'A', value: 'A', title: 'Absent' }
]

// One lesson card in the week grid.
// Normal view: P / L / A buttons with a note row underneath (No Class and Future lessons show a tag instead).
// Admin view: a single N button that marks the lesson as No Class for everyone.
export default function LessonCard({
  lesson, weekStart, isAdmin, status, note, cancelled,
  onStatus, onToggleNo, onOpenNote
}) {
  const isFuture = !isAdmin && isFutureLesson(weekStart, lesson.day)
  const isNoClass = !isAdmin && status === 'N'
  const hasNote = Boolean(note.comment) || note.online

  return (
    <div className={`lesson-card ${isFuture || isNoClass ? 'disabled' : ''}`}>
      <div className="lesson-top">
        <div className="lesson-day">
          {getFormattedLessonDate(weekStart, lesson.day)}
        </div>
        <div className="lesson-time">{lesson.time}</div>
        <span className="teacher-badge">{lesson.teacher}</span>
      </div>

      {isAdmin ? (
        <div className="status-row single">
          <button
            onClick={onToggleNo}
            title="No Class"
            className={`status-btn ${cancelled ? 'selected s-N' : ''}`}
          >
            N
          </button>
        </div>
      ) : isNoClass ? (
        <div className="future-tag">No Class</div>
      ) : isFuture ? (
        <div className="future-tag">Future Lesson</div>
      ) : (
        <div className="lesson-actions">
          <div className="status-row">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => onStatus(opt.value)}
                title={opt.title}
                className={`status-btn ${status === opt.value ? `selected s-${opt.value}` : ''}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`note-btn ${hasNote ? 'has-note' : ''}`}
            disabled={!status}
            onClick={onOpenNote}
            title={status ? 'Add or edit a note' : 'Select P, L or A first'}
          >
            {note.online && <span className="online-tag">Online</span>}
            <span className="note-text">{note.comment || 'Add note…'}</span>
          </button>
        </div>
      )}
    </div>
  )
}