import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, useBlocker } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { LESSONS, getFormattedLessonDate, isCurrentWeek } from '../constants'
import { ALL_WEEKS, findWeek } from '../utils/calendar'
import useSwipe from '../hooks/useSwipe'
import useAdminMode from '../hooks/useAdminMode'
import { useClassContext } from '../hooks/useClassData'
import Loading from '../components/Loading'
import LessonCard from '../components/LessonCard'
import NoteSheet from '../components/NoteSheet'
import ConfirmDialogue from '../components/ConfirmDialogue'

const EMPTY_NOTE = { comment: '', online: false }

// One week of lessons. Swipe left / right (or use the arrows) for the next / previous week.
// On /admin/week the same page marks whole lessons as No Class for every student.
export default function WeekPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isAdmin, base } = useAdminMode()
  const { students, selectedStudentId, setSelectedStudentId, refreshAttendance } = useClassContext()

  const selectedWeek = findWeek(searchParams.get('date'))
  const weekStart = selectedWeek.startDateStr
  const weekIndex = ALL_WEEKS.findIndex(w => w.startDateStr === weekStart)

  const [attendance, setAttendance] = useState({})   // lesson id -> 'P' | 'L' | 'A' | 'N' | null
  const [notes, setNotes] = useState({})             // lesson id -> { comment, online }
  const [noteFor, setNoteFor] = useState(null)       // lesson id whose note sheet is open
  const [loading, setLoading] = useState(true)
  const [dirty, setDirty] = useState(false)          // true when the week has unsaved changes
  const [weekSlide, setWeekSlide] = useState(null)   // direction the new week slides in from
  const loadRequest = useRef(0)                      // lets us ignore out-of-date responses

  // Admin page: this week's rows for every student, and which lessons are ticked as No Class
  const [adminRows, setAdminRows] = useState([])
  const [adminNo, setAdminNo] = useState({})

  const getNote = (lessonId) => notes[lessonId] || EMPTY_NOTE

  // Ignore any response that is still in flight when we leave the page
  useEffect(() => () => { loadRequest.current += 1 }, [])

  // Re-load attendance automatically whenever the selected student or week changes
  useEffect(() => {
    if (!isAdmin && selectedStudentId) {
      loadWeekAttendance(weekStart, selectedStudentId)
    }
  }, [weekStart, selectedStudentId, isAdmin])

  // Admin: load the whole class's rows for the week (needs the student list first)
  useEffect(() => {
    if (isAdmin && students.length > 0) {
      loadAdminWeek(weekStart)
    }
  }, [weekStart, students, isAdmin])

  // Browser back / on-screen back / tabs: ask before throwing away unsaved marks.
  // This uses an in-app dialog (shown below) because a native confirm() freezes iOS Safari
  // while it is in the middle of going back.
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirty && currentLocation.pathname !== nextLocation.pathname
  )

  async function loadWeekAttendance(week, studentId) {
    if (!week || !studentId) return
    const requestId = ++loadRequest.current
    setLoading(true)

    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('week_start', week)
      .eq('student_id', studentId)

    // A newer request has started (e.g. quick swipes), so ignore this older result
    if (requestId !== loadRequest.current) return

    const initial = {}
    const initialNotes = {}
    // Default all lessons to null so none of P, L or A start pre-selected
    LESSONS.forEach(l => { initial[l.id] = null })

    // Override with saved database records if they exist
    if (data && data.length > 0) {
      data.forEach(item => {
        initial[item.lesson_key] = item.status
        initialNotes[item.lesson_key] = { comment: item.comment || '', online: Boolean(item.online) }
      })
    }
    setAttendance(initial)
    setNotes(initialNotes)
    setNoteFor(null)
    setDirty(false)
    setLoading(false)
  }

  // A lesson counts as No Class for the admin when every student has an N row for it
  const isCancelledForClass = (rows, lessonId) =>
    students.length > 0 &&
    students.every(s => rows.some(r =>
      String(r.student_id) === String(s.id) && r.lesson_key === lessonId && r.status === 'N'
    ))

  async function loadAdminWeek(week) {
    if (!week) return
    const requestId = ++loadRequest.current
    setLoading(true)

    const { data } = await supabase
      .from('attendance')
      .select('student_id, lesson_key, status')
      .eq('week_start', week)

    // Ignore out-of-date responses (e.g. quick swipes)
    if (requestId !== loadRequest.current) return

    const rows = data || []
    const marked = {}
    LESSONS.forEach(l => { marked[l.id] = isCancelledForClass(rows, l.id) })

    setAdminRows(rows)
    setAdminNo(marked)
    setDirty(false)
    setLoading(false)
  }

  // ---------- Marking attendance and notes ----------
  const handleStatus = (lessonId, value) => {
    setAttendance(prev => ({ ...prev, [lessonId]: value }))
    // "Attended online" only makes sense for P / L
    if (value === 'A' && getNote(lessonId).online) {
      setNotes(prev => ({ ...prev, [lessonId]: { ...getNote(lessonId), online: false } }))
    }
    setDirty(true)
  }

  const updateNote = (lessonId, patch) => {
    setNotes(prev => ({ ...prev, [lessonId]: { ...(prev[lessonId] || EMPTY_NOTE), ...patch } }))
    setDirty(true)
  }

  const handleSaveAttendance = async () => {
    if (!selectedStudentId) return

    // Filter out unmarked lessons (where status is null or undefined)
    const updates = LESSONS
      .filter(lesson => attendance[lesson.id] !== null && attendance[lesson.id] !== undefined)
      .map(lesson => {
        const status = attendance[lesson.id]
        const note = getNote(lesson.id)
        const comment = note.comment.trim()
        return {
          student_id: selectedStudentId,
          week_start: weekStart,
          lesson_key: lesson.id,
          status,
          comment: comment === '' ? null : comment,
          online: status === 'A' ? false : note.online
        }
      })

    if (updates.length === 0) {
      alert('Please select attendance status for at least one lesson before saving.')
      return
    }

    setLoading(true)

    const { error } = await supabase
      .from('attendance')
      .upsert(updates, { onConflict: 'student_id,week_start,lesson_key' })

    setLoading(false)
    if (error) {
      alert('Error saving: ' + error.message)
    } else {
      setDirty(false)
      alert('Attendance saved successfully!')
      refreshAttendance()
    }
  }

  // Admin save: newly ticked lessons get N for every student, un-ticked ones lose their N rows
  const handleSaveNoClass = async () => {
    const newlyCancelled = LESSONS.filter(l => adminNo[l.id] && !isCancelledForClass(adminRows, l.id))
    const restored = LESSONS.filter(l => !adminNo[l.id] && isCancelledForClass(adminRows, l.id))

    if (newlyCancelled.length === 0 && restored.length === 0) {
      alert('No changes to save.')
      return
    }

    // Warn if marking No Class would replace existing P / L / A marks
    const newIds = new Set(newlyCancelled.map(l => l.id))
    const affected = adminRows.filter(r => newIds.has(r.lesson_key) && ['P', 'A', 'L'].includes(r.status))
    if (affected.length > 0) {
      const studentCount = new Set(affected.map(r => String(r.student_id))).size
      const ok = window.confirm(
        `${studentCount} ${studentCount === 1 ? 'student has' : 'students have'} attendance recorded for the lessons you are marking as No Class. Saving will replace their P, L or A marks. Continue?`
      )
      if (!ok) return
    }

    setLoading(true)
    let error = null

    if (newlyCancelled.length > 0) {
      // comment / online are cleared too, so an old note doesn't survive on a cancelled lesson
      const rows = students.flatMap(s =>
        newlyCancelled.map(l => ({
          student_id: s.id,
          week_start: weekStart,
          lesson_key: l.id,
          status: 'N',
          comment: null,
          online: false
        }))
      )
      const res = await supabase
        .from('attendance')
        .upsert(rows, { onConflict: 'student_id,week_start,lesson_key' })
      error = res.error
    }

    if (!error && restored.length > 0) {
      // Only ever deletes N rows, never P / L / A
      const res = await supabase
        .from('attendance')
        .delete()
        .eq('week_start', weekStart)
        .eq('status', 'N')
        .in('lesson_key', restored.map(l => l.id))
        .select('student_id')
      error = res.error
      if (!error && (!res.data || res.data.length === 0)) {
        error = { message: 'Nothing was deleted. Check that your Supabase policy allows deleting from the attendance table.' }
      }
    }

    if (error) {
      setLoading(false)
      alert('Error saving: ' + error.message)
      return
    }

    await loadAdminWeek(weekStart)
    alert('No Class lessons saved successfully!')
  }

  // ---------- Swipe navigation between weeks ----------
  const canGoWeek = (dir) => (dir === 'next' ? weekIndex < ALL_WEEKS.length - 1 : weekIndex > 0)

  const confirmDiscard = () =>
    !dirty || window.confirm('You have unsaved changes. Discard them and switch weeks?')

  // "replace" so the browser back button returns to the weeks list, not through every week you swiped past
  const goToWeek = (dir) => {
    const next = ALL_WEEKS[weekIndex + (dir === 'next' ? 1 : -1)]
    if (!next) return
    setWeekSlide(dir)
    setLoading(true) // hide the old week's marks straight away
    setDirty(false)
    navigate(`${base}/week?date=${next.startDateStr}`, { replace: true })
  }

  // Used by the arrow buttons (swipes confirm inside the swipe handler)
  const requestWeek = (dir) => {
    if (canGoWeek(dir) && confirmDiscard()) goToWeek(dir)
  }

  const weekSwipe = useSwipe({
    enabled: true,
    canGo: canGoWeek,
    confirmGo: confirmDiscard,
    onGo: goToWeek
  })

  const sheetLesson = noteFor ? LESSONS.find(l => l.id === noteFor) : null

  return (
    <section className="view">
      <div className="week-header">
        <div className="week-header-top">
          <button
            className="nav-arrow"
            aria-label="Previous week"
            disabled={!canGoWeek('prev')}
            onClick={() => requestWeek('prev')}
          >
            &lsaquo;
          </button>
          <div className="week-header-range">
            <span className="week-header-eyebrow">
              Week Range {isCurrentWeek(weekStart) && <span className="current-inline-badge">• Current Week</span>}
            </span>
            <h2 className="week-header-title">{selectedWeek.label}</h2>
          </div>
          <button
            className="nav-arrow"
            aria-label="Next week"
            disabled={!canGoWeek('next')}
            onClick={() => requestWeek('next')}
          >
            &rsaquo;
          </button>
        </div>
        {!isAdmin && (
          <div className="week-header-select">
            <label className="select-label">Select Student</label>
            <select
              value={selectedStudentId}
              onChange={e => { setWeekSlide(null); setSelectedStudentId(e.target.value) }}
              className="select"
            >
              {students.map(s => (
                <option key={s.id} value={s.id}>#{s.roll_no} — {s.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="swipe-area" ref={weekSwipe.areaRef}>
        {loading ? (
          <Loading label="Loading attendance records..." />
        ) : (
          <div
            key={weekStart}
            ref={weekSwipe.contentRef}
            className={`lesson-grid ${weekSlide ? `slide-in-${weekSlide}` : ''}`}
            onAnimationEnd={e => { if (e.target === e.currentTarget) setWeekSlide(null) }}
          >
            {LESSONS.map(lesson => (
              <LessonCard
                key={lesson.id}
                lesson={lesson}
                weekStart={weekStart}
                isAdmin={isAdmin}
                status={attendance[lesson.id]}
                note={getNote(lesson.id)}
                cancelled={Boolean(adminNo[lesson.id])}
                onStatus={(value) => handleStatus(lesson.id, value)}
                onToggleNo={() => {
                  setAdminNo(prev => ({ ...prev, [lesson.id]: !prev[lesson.id] }))
                  setDirty(true)
                }}
                onOpenNote={() => setNoteFor(lesson.id)}
              />
            ))}
          </div>
        )}
      </div>

      {!loading && (
        <button onClick={isAdmin ? handleSaveNoClass : handleSaveAttendance} className="submit-btn">
          {isAdmin ? 'Save No Class Lessons' : 'Save Attendance Record'}
        </button>
      )}

      {blocker.state === 'blocked' && (
        <ConfirmDialogue
          message="You have unsaved changes. Discard them and leave this page?"
          onConfirm={() => blocker.proceed()}
          onCancel={() => blocker.reset()}
        />
      )}

      {sheetLesson && (
        <NoteSheet
          lessonLabel={`${getFormattedLessonDate(weekStart, sheetLesson.day)} · ${sheetLesson.time}`}
          status={attendance[sheetLesson.id]}
          online={getNote(sheetLesson.id).online}
          comment={getNote(sheetLesson.id).comment}
          onOnlineChange={(value) => updateNote(sheetLesson.id, { online: value })}
          onCommentChange={(value) => updateNote(sheetLesson.id, { comment: value })}
          onClose={() => setNoteFor(null)}
        />
      )}
    </section>
  )
}