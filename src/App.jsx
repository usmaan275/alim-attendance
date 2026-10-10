import React, { useState, useEffect, useRef } from 'react'
import { supabase } from './supabaseClient'
import { LESSONS, MONTHS, getWeeksForMonth, getFormattedLessonDate, isFutureLesson, isCurrentMonth, isCurrentWeek, getLessonDateObj } from './constants'
import './App.css'
import './swipe.css'

// ---------- Advanced analytics filter options (derived from LESSONS) ----------
const ALL_TEACHERS = 'All Teachers'
const ALL_DAYS = 'All Days'
const ALL_MONTHS = 'All Months'
const TEACHERS = [ALL_TEACHERS, ...new Set(LESSONS.map(l => l.teacher))]
const DAYS = [ALL_DAYS, ...new Set(LESSONS.map(l => l.day))]
const LESSON_BY_ID = Object.fromEntries(LESSONS.map(l => [l.id, l]))

// ---------- Hidden admin page: reached only by typing /admin into the address bar ----------
const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin'

// ---------- Every week of the term in order (used for swiping between weeks) ----------
// A week that touches two months is listed once.
const ALL_WEEKS = (() => {
  const seen = new Set()
  const list = []
  MONTHS.forEach(m => {
    getWeeksForMonth(m.year, m.month).forEach(w => {
      if (!seen.has(w.startDateStr)) {
        seen.add(w.startDateStr)
        list.push(w)
      }
    })
  })
  return list.sort((a, b) => a.startDateStr.localeCompare(b.startDateStr))
})()

// Which month should "Back to Weeks" return to for a given week?
// Keeps the current month if the week belongs to it, otherwise picks the first month that does.
const monthForWeek = (week, preferred) => {
  const contains = (m) => getWeeksForMonth(m.year, m.month).some(w => w.startDateStr === week.startDateStr)
  if (preferred && contains(preferred)) return preferred
  return MONTHS.find(contains) || preferred
}

// ---------- Swipe settings ----------
const SWIPE_SNAP = 0.25 // drag at least 25% of the width to change page
const SWIPE_EDGE = 20   // px: ignore touches starting at the screen edge (iOS back gesture)
const SWIPE_MS = 200    // slide-out duration

/**
 * Touch-drag carousel behaviour.
 * - areaRef    -> the stable wrapper that listens for touches
 * - contentRef -> the element that follows the finger (re-created for each page)
 * - canGo(dir)      whether there is a page in that direction ('next' | 'prev')
 * - confirmGo(dir)  optional: return false to cancel (e.g. unsaved changes)
 * - onGo(dir)       change the page
 */
function useSwipe({ enabled, canGo, confirmGo, onGo }) {
  const areaRef = useRef(null)
  const contentRef = useRef(null)
  const latest = useRef({})
  latest.current = { canGo, confirmGo, onGo }

  useEffect(() => {
    const area = areaRef.current
    if (!enabled || !area) return

    let startX = 0
    let startY = 0
    let startT = 0
    let tracking = false
    let horizontal = null // null = undecided, then true / false once the direction is locked
    let busy = false
    let swallowClick = false
    let timer = null
    let clickTimer = null

    const drag = (x) => {
      const el = contentRef.current
      if (!el) return
      el.style.transition = 'none'
      el.style.transform = `translate3d(${x}px, 0, 0)`
    }

    const settle = (x, fade) => {
      const el = contentRef.current
      if (!el) return
      el.style.transition = `transform ${SWIPE_MS}ms ease, opacity ${SWIPE_MS}ms ease`
      el.style.transform = `translate3d(${x}px, 0, 0)`
      el.style.opacity = fade ? '0' : '1'
    }

    const onStart = (e) => {
      if (busy || e.touches.length !== 1 || !contentRef.current) return
      const t = e.touches[0]
      if (t.clientX < SWIPE_EDGE || t.clientX > window.innerWidth - SWIPE_EDGE) return
      startX = t.clientX
      startY = t.clientY
      startT = Date.now()
      tracking = true
      horizontal = null
    }

    const onMove = (e) => {
      if (!tracking) return
      const t = e.touches[0]
      const dx = t.clientX - startX
      const dy = t.clientY - startY

      if (horizontal === null) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
        horizontal = Math.abs(dx) > Math.abs(dy)
      }
      if (!horizontal) return

      if (e.cancelable) e.preventDefault()
      const dir = dx < 0 ? 'next' : 'prev'
      // Rubber-band resistance when there is nothing further in that direction
      drag(latest.current.canGo(dir) ? dx : dx * 0.25)
    }

    const onEnd = (e) => {
      if (!tracking) return
      tracking = false
      if (!horizontal) return

      // The finger moved sideways, so ignore the click the browser may still fire
      swallowClick = true
      clickTimer = setTimeout(() => { swallowClick = false }, 350)

      const dx = e.changedTouches[0].clientX - startX
      const width = area.offsetWidth
      const far = Math.abs(dx) > width * SWIPE_SNAP
      const quick = Date.now() - startT < 250 && Math.abs(dx) > 40
      const dir = dx < 0 ? 'next' : 'prev'
      const { canGo, confirmGo, onGo } = latest.current

      const commit = (far || quick) && canGo(dir) && (!confirmGo || confirmGo(dir))

      busy = true
      if (!commit) {
        settle(0, false)
        timer = setTimeout(() => { busy = false }, SWIPE_MS)
        return
      }

      settle(dx < 0 ? -width : width, true)
      timer = setTimeout(() => {
        onGo(dir)
        busy = false
      }, SWIPE_MS)
    }

    const onCancel = () => {
      if (tracking && horizontal) settle(0, false)
      tracking = false
    }

    const onClickCapture = (e) => {
      if (swallowClick) {
        e.stopPropagation()
        e.preventDefault()
      }
    }

    area.addEventListener('touchstart', onStart, { passive: true })
    area.addEventListener('touchmove', onMove, { passive: false })
    area.addEventListener('touchend', onEnd, { passive: true })
    area.addEventListener('touchcancel', onCancel, { passive: true })
    area.addEventListener('click', onClickCapture, true)

    return () => {
      area.removeEventListener('touchstart', onStart)
      area.removeEventListener('touchmove', onMove)
      area.removeEventListener('touchend', onEnd)
      area.removeEventListener('touchcancel', onCancel)
      area.removeEventListener('click', onClickCapture, true)
      clearTimeout(timer)
      clearTimeout(clickTimer)
    }
  }, [enabled])

  return { areaRef, contentRef }
}

// ---------- Good / warn / bad thresholds (tweak these to taste) ----------
// Attendance rate: higher is better
const ATTENDANCE_GOOD = 70 // >= 70%  -> good
const ATTENDANCE_WARN = 50 // >= 50%  -> warn, below -> bad
// Lateness rate: lower is better
const LATENESS_GOOD = 20 // <= 20%  -> good
const LATENESS_WARN = 40 // <= 40%  -> warn, above -> bad

const attendanceTone = (pct) => {
  if (pct === 'N/A') return 'neutral'
  const n = parseFloat(pct)
  if (n >= ATTENDANCE_GOOD) return 'good'
  if (n >= ATTENDANCE_WARN) return 'warn'
  return 'low'
}

const latenessTone = (pct) => {
  if (pct === 'N/A') return 'neutral'
  const n = parseFloat(pct)
  if (n <= LATENESS_GOOD) return 'good'
  if (n <= LATENESS_WARN) return 'warn'
  return 'low'
}

// Counts P / L / A records and works out the attendance rate
const tally = (records) => {
  const present = records.filter(a => a.status === 'P').length
  const late = records.filter(a => a.status === 'L').length
  const absent = records.filter(a => a.status === 'A').length
  const total = present + late + absent
  const attended = present + late
  const pct = total > 0 ? ((attended / total) * 100).toFixed(1) : 'N/A'
  return { present, late, absent, total, attended, pct }
}

export default function App() {
  const [view, setView] = useState('home') // 'home' | 'month' | 'week' | 'stats' | 'advanced_stats'
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [students, setStudents] = useState([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [attendance, setAttendance] = useState({})
  const [allAttendance, setAllAttendance] = useState([])
  const [attendanceLoading, setAttendanceLoading] = useState(true) // true while the stats data is being fetched
  const [loading, setLoading] = useState(false)

  // Swipe navigation
  const [weekSlide, setWeekSlide] = useState(null)   // direction the new week slides in from: 'next' | 'prev' | null
  const [monthSlide, setMonthSlide] = useState(null) // same, for the month's weeks list
  const [dirty, setDirty] = useState(false)          // true when the week has unsaved changes
  const loadRequest = useRef(0)                      // lets us ignore out-of-date responses

  // Admin page: this week's rows for every student, and which lessons are ticked as No Class
  const [adminRows, setAdminRows] = useState([])
  const [adminNo, setAdminNo] = useState({})

  // Advanced analytics filters
  const [analyticsScope, setAnalyticsScope] = useState('ALL')
  const [selectedTeacher, setSelectedTeacher] = useState(ALL_TEACHERS)
  const [analyticsMonth, setAnalyticsMonth] = useState(ALL_MONTHS)
  const [selectedDay, setSelectedDay] = useState(ALL_DAYS)

  useEffect(() => {
    fetchStudents()
    fetchAllAttendance()
  }, [])

  // Re-load attendance automatically whenever selected student or week changes
  useEffect(() => {
    if (!isAdmin && view === 'week' && selectedWeek && selectedStudentId) {
      loadWeekAttendance(selectedWeek.startDateStr, selectedStudentId)
    }
  }, [selectedStudentId, selectedWeek, view])

  // Admin: load the whole class's rows for the week (needs the student list first)
  useEffect(() => {
    if (isAdmin && view === 'week' && selectedWeek && students.length > 0) {
      loadAdminWeek(selectedWeek.startDateStr)
    }
  }, [selectedWeek, view, students])

  async function fetchStudents() {
    const { data } = await supabase.from('students').select('*').order('roll_no')
    if (data && data.length > 0) {
      setStudents(data)
      setSelectedStudentId(data[0].id)
    }
  }

  async function fetchAllAttendance() {
    setAttendanceLoading(true)

    // Supabase returns at most 1000 rows per request, so fetch the table in pages
    // (ordered by the unique key so pages never overlap or skip rows)
    const PAGE_SIZE = 1000
    let all = []
    let total = null

    while (total === null || all.length < total) {
      const { data, error, count } = await supabase
        .from('attendance')
        .select('student_id, week_start, lesson_key, status', { count: 'exact' })
        .order('week_start')
        .order('lesson_key')
        .order('student_id')
        .range(all.length, all.length + PAGE_SIZE - 1)

      if (error) {
        console.error('Error loading attendance:', error.message)
        setAttendanceLoading(false)
        return // keep the data we already had rather than showing partial numbers
      }
      if (total === null) total = count
      if (!data || data.length === 0) break
      all = all.concat(data)
    }

    setAllAttendance(all)
    setAttendanceLoading(false)
  }

  async function loadWeekAttendance(weekStart, studentId) {
    if (!weekStart || !studentId) return
    const requestId = ++loadRequest.current
    setLoading(true)

    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('week_start', weekStart)
      .eq('student_id', studentId)

    // A newer request has started (e.g. quick swipes), so ignore this older result
    if (requestId !== loadRequest.current) return

    const initial = {}
    // Default all lessons to null so none of P, A, L, or N start pre-selected
    LESSONS.forEach(l => { initial[l.id] = null })

    // Override with saved database records if they exist
    if (data && data.length > 0) {
      data.forEach(item => {
        initial[item.lesson_key] = item.status
      })
    }
    setAttendance(initial)
    setDirty(false)
    setLoading(false)
  }

  // A lesson counts as No Class for the admin when every student has an N row for it
  const isCancelledForClass = (rows, lessonId) =>
    students.length > 0 &&
    students.every(s => rows.some(r =>
      String(r.student_id) === String(s.id) && r.lesson_key === lessonId && r.status === 'N'
    ))

  async function loadAdminWeek(weekStart) {
    if (!weekStart) return
    const requestId = ++loadRequest.current
    setLoading(true)

    const { data } = await supabase
      .from('attendance')
      .select('student_id, lesson_key, status')
      .eq('week_start', weekStart)

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

  const handleSaveAttendance = async () => {
    if (!selectedStudentId || !selectedWeek) return

    // Filter out unmarked lessons (where status is null or undefined)
    const updates = LESSONS
      .filter(lesson => attendance[lesson.id] !== null && attendance[lesson.id] !== undefined)
      .map(lesson => ({
        student_id: selectedStudentId,
        week_start: selectedWeek.startDateStr,
        lesson_key: lesson.id,
        status: attendance[lesson.id]
      }))

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
      fetchAllAttendance()
    }
  }

  // Admin save: newly ticked lessons get N for every student, un-ticked ones lose their N rows
  const handleSaveNoClass = async () => {
    if (!selectedWeek) return
    const weekStart = selectedWeek.startDateStr

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
      const rows = students.flatMap(s =>
        newlyCancelled.map(l => ({
          student_id: s.id,
          week_start: weekStart,
          lesson_key: l.id,
          status: 'N'
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

  const calculateClassStats = () => {
    if (students.length === 0) return []

    const markedSessions = new Set(
      allAttendance.filter(a => ['P', 'A', 'L'].includes(a.status)).map(a => `${a.week_start}_${a.lesson_key}`)
    )
    const denominator = markedSessions.size

    return students.map(s => {
      const studentRecords = allAttendance.filter(
        a => a.student_id === s.id && ['P', 'A', 'L'].includes(a.status)
      )
      const presentCount = studentRecords.filter(a => a.status === 'P' || a.status === 'L').length
      const pct = denominator > 0 ? ((presentCount / denominator) * 100).toFixed(1) : 'N/A'

      return {
        ...s,
        presentCount,
        denominator,
        pct
      }
    }).sort((a, b) => b.presentCount - a.presentCount)
  }

  const calculateLatenessStats = () => {
    if (students.length === 0) return []

    return students
      .map(s => {
        const studentRecords = allAttendance.filter(
          a => a.student_id === s.id && ['P', 'L'].includes(a.status)
        )

        const presentCount = studentRecords.filter(a => a.status === 'P').length
        const lateCount = studentRecords.filter(a => a.status === 'L').length
        const attendedCount = presentCount + lateCount

        const pct = attendedCount > 0
          ? ((lateCount / attendedCount) * 100).toFixed(1)
          : 'N/A'

        return {
          ...s,
          presentCount,
          lateCount,
          attendedCount,
          pct
        }
      })
      .sort((a, b) => {
        if (a.pct === 'N/A') return 1
        if (b.pct === 'N/A') return -1
        return parseFloat(b.pct) - parseFloat(a.pct)
      })
  }

  // ---------- Advanced analytics ----------
  // Marked (P / A / L) records that match the scope, teacher and day filters
  const getFilteredRecords = () =>
    allAttendance.filter(a => {
      if (!['P', 'A', 'L'].includes(a.status)) return false
      if (analyticsScope !== 'ALL' && String(a.student_id) !== String(analyticsScope)) return false

      const lesson = LESSON_BY_ID[a.lesson_key]
      if (!lesson) return false
      if (selectedTeacher !== ALL_TEACHERS && lesson.teacher !== selectedTeacher) return false
      if (selectedDay !== ALL_DAYS && lesson.day !== selectedDay) return false

      if (analyticsMonth !== ALL_MONTHS) {
        const month = MONTHS.find(m => m.name === analyticsMonth)
        const dateObj = getLessonDateObj(a.week_start, lesson.day)
        if (!month || !dateObj) return false
        if (dateObj.getFullYear() !== month.year || dateObj.getMonth() !== month.month) return false
      }
      return true
    })

  const filteredRecords = view === 'advanced_stats' ? getFilteredRecords() : []

  const buildSummary = () => {
    const overall = tally(filteredRecords)

    const punctualityPct = overall.attended > 0
      ? ((overall.present / overall.attended) * 100).toFixed(1)
      : 'N/A'

    // Day of the week with the most absences
    const absencesByDay = {}
    filteredRecords
      .filter(a => a.status === 'A')
      .forEach(a => {
        const day = LESSON_BY_ID[a.lesson_key].day
        absencesByDay[day] = (absencesByDay[day] || 0) + 1
      })
    const ranked = Object.entries(absencesByDay).sort((a, b) => b[1] - a[1])
    const mostMissedDay = ranked.length > 0 ? ranked[0][0] : 'N/A'

    return {
      overallPct: overall.pct,
      punctualityPct,
      mostMissedDay,
      totalRecorded: overall.total
    }
  }

  const summary = buildSummary()

  // Monthly breakdown: checks exact date of each lesson record
  const getMonthAnalytics = (year, monthIndex) => {
    const monthRecords = filteredRecords.filter(a => {
      const lesson = LESSON_BY_ID[a.lesson_key]
      if (!lesson) return false

      const dateObj = getLessonDateObj(a.week_start, lesson.day)
      if (!dateObj) return false

      // Matches exact year and month of the lesson itself
      return dateObj.getFullYear() === year && dateObj.getMonth() === monthIndex
    })

    const stats = tally(monthRecords)
    return {
      ...stats,
      // Total lessons evaluated for this exact month
      total: monthRecords.length
    }
  }

  const punctualityTone = summary.punctualityPct === 'N/A'
    ? 'neutral'
    : latenessTone(100 - parseFloat(summary.punctualityPct))

  // Stats page: show spinners until both the students and their attendance have loaded
  const statsLoading = attendanceLoading || students.length === 0

  // ---------- Swipe navigation: weeks ----------
  const weekIndex = selectedWeek
    ? ALL_WEEKS.findIndex(w => w.startDateStr === selectedWeek.startDateStr)
    : -1

  const canGoWeek = (dir) => (dir === 'next' ? weekIndex < ALL_WEEKS.length - 1 : weekIndex > 0)

  const confirmDiscard = () =>
    !dirty || window.confirm('You have unsaved changes. Discard them and switch weeks?')

  const goToWeek = (dir) => {
    const next = ALL_WEEKS[weekIndex + (dir === 'next' ? 1 : -1)]
    if (!next) return
    setWeekSlide(dir)
    setLoading(true) // hide the old week's marks straight away
    setDirty(false)
    setSelectedMonth(prev => monthForWeek(next, prev))
    setSelectedWeek(next)
  }

  // Used by the arrow buttons (swipes confirm inside the swipe handler)
  const requestWeek = (dir) => {
    if (canGoWeek(dir) && confirmDiscard()) goToWeek(dir)
  }

  // ---------- Swipe navigation: months ----------
  const monthIndex = selectedMonth
    ? MONTHS.findIndex(m => m.name === selectedMonth.name)
    : -1

  const canGoMonth = (dir) => (dir === 'next' ? monthIndex < MONTHS.length - 1 : monthIndex > 0)

  const goToMonth = (dir) => {
    const next = MONTHS[monthIndex + (dir === 'next' ? 1 : -1)]
    if (!next) return
    setMonthSlide(dir)
    setSelectedMonth(next)
  }

  const weekSwipe = useSwipe({
    enabled: view === 'week' && !!selectedWeek,
    canGo: canGoWeek,
    confirmGo: confirmDiscard,
    onGo: goToWeek
  })

  const monthSwipe = useSwipe({
    enabled: view === 'month' && !!selectedMonth,
    canGo: canGoMonth,
    onGo: goToMonth
  })

  const navigateToHome = () => {
    setSelectedMonth(null)
    setSelectedWeek(null)
    setView('home')
  }

  const back =
    view === 'month' ? { action: navigateToHome, label: 'Back to Months' } :
      view === 'week' ? { action: () => setView('month'), label: 'Back to Weeks' } :
        view === 'advanced_stats' ? { action: () => setView('stats'), label: 'Back to Analytics' } :
          isAdmin && view === 'home' ? { action: () => window.location.assign('/'), label: 'Back to Dashboard' } :
            null

  return (
    <div className={`shell ${isAdmin ? 'admin' : ''}`}>
      <div className="app">
        <div className="topbar">
          {back && (
            <button onClick={back.action} className="back-btn">
              &larr; {back.label}
            </button>
          )}
        </div>

        <header className="header">
          <div className="brand">
            <h1 className="title">Alim Class Year 5</h1>
            <p className="subtitle">Attendance Tracking System</p>
          </div>
          {!isAdmin && (
          <nav className="tabs">
            <button
              onClick={navigateToHome}
              className={`tab ${view === 'home' || view === 'month' || view === 'week' ? 'active' : ''}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => { fetchAllAttendance(); setView('stats'); }}
              className={`tab ${view === 'stats' || view === 'advanced_stats' ? 'active' : ''}`}
            >
              Analytics &amp; Stats
            </button>
          </nav>
          )}
        </header>

        {/* 1. HOME VIEW: Month Grid */}
        {view === 'home' && (
          <section className="view">
            <h2 className="section-title">Select Month</h2>
            <div className="month-grid">
              {MONTHS.map(m => {
                const isCurrent = isCurrentMonth(m.year, m.month)
                return (
                  <button
                    key={m.name}
                    onClick={() => { setSelectedMonth(m); setMonthSlide(null); setView('month'); }}
                    className={`month-card ${isCurrent ? 'current-glow' : ''}`}
                  >
                    <span className="month-name">{m.name.split(' ')[0]}</span>
                    <span className="month-year">{m.name.split(' ')[1]}</span>
                    {isCurrent && <span className="current-badge">Current Month</span>}
                  </button>
                )
              })}
            </div>
          </section>
        )}

        {/* 2. MONTH VIEW: Weeks List (swipe left / right for next / previous month) */}
        {view === 'month' && selectedMonth && (
          <section className="view">
            <div className="title-row">
              <button
                className="nav-arrow"
                aria-label="Previous month"
                disabled={!canGoMonth('prev')}
                onClick={() => goToMonth('prev')}
              >
                &lsaquo;
              </button>
              <h2 className="section-title">{selectedMonth.name}</h2>
              <button
                className="nav-arrow"
                aria-label="Next month"
                disabled={!canGoMonth('next')}
                onClick={() => goToMonth('next')}
              >
                &rsaquo;
              </button>
            </div>
            <p className="section-sub">Select a week to log or review attendance:</p>

            <div className="swipe-area tall" ref={monthSwipe.areaRef}>
              <div
                key={selectedMonth.name}
                ref={monthSwipe.contentRef}
                className={`week-list ${monthSlide ? `slide-in-${monthSlide}` : ''}`}
                onAnimationEnd={e => { if (e.target === e.currentTarget) setMonthSlide(null) }}
              >
                {getWeeksForMonth(selectedMonth.year, selectedMonth.month).map(w => {
                  const isCurrent = isCurrentWeek(w.startDateStr)
                  return (
                    <button
                      key={w.startDateStr}
                      onClick={() => { setSelectedWeek(w); setWeekSlide(null); setView('week'); }}
                      className={`week-card ${isCurrent ? 'current-glow' : ''}`}
                    >
                      <span className="week-card-text">
                        <span className="week-card-label">
                          Week Range {isCurrent && <span className="current-inline-badge">• Current Week</span>}
                        </span>
                        <span className="week-card-value">{w.label}</span>
                      </span>
                      <span className="week-card-arrow">&rarr;</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        {/* 3. WEEK VIEW (swipe left / right for next / previous week) */}
        {view === 'week' && selectedWeek && (
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
                    Week Range {isCurrentWeek(selectedWeek.startDateStr) && <span className="current-inline-badge">• Current Week</span>}
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
                <div className="loading" role="status">
                  <span className="spinner" aria-hidden="true" />
                  <span className="sr-only">Loading attendance records...</span>
                </div>
              ) : (
                <div
                  key={selectedWeek.startDateStr}
                  ref={weekSwipe.contentRef}
                  className={`lesson-grid ${weekSlide ? `slide-in-${weekSlide}` : ''}`}
                  onAnimationEnd={e => { if (e.target === e.currentTarget) setWeekSlide(null) }}
                >
                  {LESSONS.map(lesson => {
                    const isFuture = !isAdmin && isFutureLesson(selectedWeek?.startDateStr, lesson.day)
                    const isNoClass = !isAdmin && attendance[lesson.id] === 'N'

                    return (
                      <div key={lesson.id} className={`lesson-card ${isFuture || isNoClass ? 'disabled' : ''}`}>
                        <div className="lesson-top">
                          <div className="lesson-day">
                            {getFormattedLessonDate(selectedWeek?.startDateStr, lesson.day)}
                          </div>
                          <div className="lesson-time">{lesson.time}</div>
                          <span className="teacher-badge">{lesson.teacher}</span>
                        </div>

                        {isAdmin ? (
                          <div className="status-row single">
                            <button
                              onClick={() => {
                                setAdminNo(prev => ({ ...prev, [lesson.id]: !prev[lesson.id] }))
                                setDirty(true)
                              }}
                              title="No Class"
                              className={`status-btn ${adminNo[lesson.id] ? 'selected s-N' : ''}`}
                            >
                              N
                            </button>
                          </div>
                        ) : isNoClass ? (
                          <div className="future-tag">No Class</div>
                        ) : isFuture ? (
                          <div className="future-tag">Future Lesson</div>
                        ) : (
                          <div className="status-row">
                            {[
                              { label: 'P', value: 'P', title: 'Present' },
                              { label: 'L', value: 'L', title: 'Late' },
                              { label: 'A', value: 'A', title: 'Absent' }
                            ].map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => {
                                  setAttendance(prev => ({ ...prev, [lesson.id]: opt.value }))
                                  setDirty(true)
                                }}
                                title={opt.title}
                                className={`status-btn ${attendance[lesson.id] === opt.value ? `selected s-${opt.value}` : ''}`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {!loading && (
              <button onClick={isAdmin ? handleSaveNoClass : handleSaveAttendance} className="submit-btn">
                {isAdmin ? 'Save No Class Lessons' : 'Save Attendance Record'}
              </button>
            )}
          </section>
        )}

        {/* 4. STATS VIEW */}
        {view === 'stats' && (
          <section className="view">
            {/* Action Button at the Bottom */}
            <button
              onClick={() => setView('advanced_stats')}
              className="advanced-analytics-btn"
            >
              Deep Insights &amp; Advanced Filters &rarr;
            </button>
            <h2 className="section-title">Class Attendance Overview</h2>
            <p className="section-sub">
              Statistics are based on all marked sessions across the term. Attendance rate is calculated as attended lessons (presents + lates) divided by total marked sessions.
            </p>

            {statsLoading ? (
              <div className="loading table-loading" role="status">
                <span className="spinner" aria-hidden="true" />
                <span className="sr-only">Loading attendance statistics...</span>
              </div>
            ) : (
            <div className="table-wrap">
              <table className="table">
                <colgroup>
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '36%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '20%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Student Name</th>
                    <th>Attended</th>
                    <th>Total</th>
                    <th>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {calculateClassStats().map(s => (
                    <tr key={s.id}>
                      <td><span className="roll-badge">#{s.roll_no}</span></td>
                      <td className="student-name"><span>{s.name}</span></td>
                      <td className="attended">{s.presentCount}</td>
                      <td className="total">{s.denominator}</td>
                      <td>
                        <span className={`pct-badge ${attendanceTone(s.pct)}`}>
                          {s.pct}{s.pct !== 'N/A' && '%'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}

            <h2 className="section-title spaced">
              Class Lateness Overview
            </h2>
            <p className="section-sub">
              Lateness is calculated as late lessons divided by attended lessons (presents + lates).
            </p>

            {statsLoading ? (
              <div className="loading table-loading" role="status">
                <span className="spinner" aria-hidden="true" />
                <span className="sr-only">Loading attendance statistics...</span>
              </div>
            ) : (
            <div className="table-wrap">
              <table className="table">
                <colgroup>
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '36%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '20%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Student Name</th>
                    <th>Late</th>
                    <th>Attended</th>
                    <th>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {calculateLatenessStats().map(s => (
                    <tr key={s.id}>
                      <td>
                        <span className="roll-badge">#{s.roll_no}</span>
                      </td>
                      <td className="student-name">
                        <span>{s.name}</span>
                      </td>
                      <td className="num">{s.lateCount}</td>
                      <td className="num">{s.attendedCount}</td>
                      <td>
                        <span className={`pct-badge ${latenessTone(s.pct)}`}>
                          {s.pct}{s.pct !== 'N/A' && '%'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}
          </section>
        )}

        {/* 5. ADVANCED HYBRID ANALYTICS PAGE */}
        {view === 'advanced_stats' && (
          <section className="view">
            <div className="analytics-top">
              <div>
                <h2 className="section-title">Advanced Performance Analytics</h2>
                <p className="section-sub">Filter attendance insights by student, teacher, or day of the week.</p>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="filter-card">
              <div className="filter-group">
                <label className="filter-label">Filter by Student</label>
                <select
                  value={analyticsScope}
                  onChange={e => setAnalyticsScope(e.target.value)}
                  className="select"
                >
                  <option value="ALL">All Students</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Filter by Teacher</label>
                <select
                  value={selectedTeacher}
                  onChange={e => setSelectedTeacher(e.target.value)}
                  className="select"
                >
                  {TEACHERS.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Filter by Month</label>
                <select
                  value={analyticsMonth}
                  onChange={e => setAnalyticsMonth(e.target.value)}
                  className="select"
                >
                  <option value={ALL_MONTHS}>{ALL_MONTHS}</option>
                  {MONTHS.map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">Filter by Day</label>
                <select
                  value={selectedDay}
                  onChange={e => setSelectedDay(e.target.value)}
                  className="select"
                >
                  {DAYS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4 Stat Summary Cards */}
            <div className="stats-summary-grid">
              <div className="summary-card">
                <span className="summary-title">Attendance Rate</span>
                <span className={`summary-value ${attendanceTone(summary.overallPct)}`}>
                  {summary.overallPct}{summary.overallPct !== 'N/A' && '%'}
                </span>
                <span className="summary-sub">Present or Late vs Total</span>
              </div>

              <div className="summary-card">
                <span className="summary-title">Punctuality Score</span>
                <span className={`summary-value ${punctualityTone}`}>
                  {summary.punctualityPct}{summary.punctualityPct !== 'N/A' && '%'}
                </span>
                <span className="summary-sub">On-time vs Late arrivals</span>
              </div>

              <div className="summary-card">
                <span className="summary-title">Most Missed Day</span>
                <span className={`summary-value ${summary.mostMissedDay === 'N/A' ? 'neutral' : 'warn'}`}>
                  {summary.mostMissedDay}
                </span>
                <span className="summary-sub">Highest absence frequency</span>
              </div>

              <div className="summary-card">
                <span className="summary-title">Total Lessons Evaluated</span>
                <span className="summary-value neutral">{summary.totalRecorded}</span>
                <span className="summary-sub">Recorded marked entries</span>
              </div>
            </div>

            {/* Monthly Grid 3x4 */}
            <h3 className="section-subtitle">Monthly Breakdown</h3>
            <div className="month-grid analytics-month-grid">
              {MONTHS.map(m => {
                const monthStats = getMonthAnalytics(m.year, m.month)
                return (
                  <div key={m.name} className="analytics-month-card">
                    <div className="analytics-month-header">
                      <span className="month-name">{m.name.split(' ')[0]}</span>
                      <span className="month-year">{m.name.split(' ')[1]}</span>
                    </div>

                    <div className="analytics-month-body">
                      <div className="month-rate-badge">
                        <span className={`rate-num ${attendanceTone(monthStats.pct)}`}>
                          {monthStats.pct}{monthStats.pct !== 'N/A' && '%'}
                        </span>
                        <span className="rate-lbl">Rate</span>
                      </div>

                      <div className="month-mini-stats">
                        <div className="stat-pill t-bg">T: {monthStats.total}</div>
                        <div className="stat-pill p-bg">P: {monthStats.present}</div>
                        <div className="stat-pill l-bg">L: {monthStats.late}</div>
                        <div className="stat-pill a-bg">A: {monthStats.absent}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}