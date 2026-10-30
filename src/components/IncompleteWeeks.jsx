import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClassContext } from '../hooks/useClassData'
import { findIncompleteWeeks, formatWeekRange } from '../utils/incomplete'

const SHOW_FIRST = 4 // weeks listed per student before "+N more"

// Dashboard warning: past weeks a student hasn't completed. Tap a week to open it for that student.
export default function IncompleteWeeks() {
  const navigate = useNavigate()
  const { students, allAttendance, attendanceLoading, setSelectedStudentId } = useClassContext()
  const [expanded, setExpanded] = useState({}) // student id -> show every week

  const items = useMemo(
    () => (attendanceLoading ? [] : findIncompleteWeeks(students, allAttendance)),
    [students, allAttendance, attendanceLoading]
  )

  // Nothing is shown while the data loads, so nobody looks incomplete for a moment
  if (items.length === 0) return null

  const openWeek = (student, weekStart) => {
    setSelectedStudentId(student.id)
    navigate(`/week?date=${weekStart}`)
  }

  return (
    <div className="incomplete-card" role="status">
      {items.map(({ student, weeks }) => {
        const showAll = expanded[student.id] || weeks.length <= SHOW_FIRST + 1
        const shown = showAll ? weeks : weeks.slice(0, SHOW_FIRST)
        const hidden = weeks.length - shown.length

        return (
          <p key={student.id} className="incomplete-line">
            <strong>{student.name}</strong> has not completed his attendance record for the following weeks:{' '}
            {shown.map(w => (
              <button
                key={w}
                type="button"
                className="week-chip"
                onClick={() => openWeek(student, w)}
              >
                {formatWeekRange(w)}
              </button>
            ))}
            {hidden > 0 && (
              <button
                type="button"
                className="week-chip more"
                onClick={() => setExpanded(prev => ({ ...prev, [student.id]: true }))}
              >
                +{hidden} more
              </button>
            )}
          </p>
        )
      })}
    </div>
  )
}