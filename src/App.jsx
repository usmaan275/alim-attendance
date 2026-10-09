import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { LESSONS, MONTHS, getWeeksForMonth, getFormattedLessonDate, isFutureLesson, isCurrentMonth, isCurrentWeek, getLessonDateObj } from './constants'
import './App.css'

// ---------- Advanced analytics filter options (derived from LESSONS) ----------
const ALL_TEACHERS = 'All Teachers'
const ALL_DAYS = 'All Days'
const TEACHERS = [ALL_TEACHERS, ...new Set(LESSONS.map(l => l.teacher))]
const DAYS = [ALL_DAYS, ...new Set(LESSONS.map(l => l.day))]
const LESSON_BY_ID = Object.fromEntries(LESSONS.map(l => [l.id, l]))

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
  const [loading, setLoading] = useState(false)

  // Advanced analytics filters
  const [analyticsScope, setAnalyticsScope] = useState('ALL')
  const [selectedTeacher, setSelectedTeacher] = useState(ALL_TEACHERS)
  const [selectedDay, setSelectedDay] = useState(ALL_DAYS)

  useEffect(() => {
    fetchStudents()
    fetchAllAttendance()
  }, [])

  // Re-load attendance automatically whenever selected student or week changes
  useEffect(() => {
    if (view === 'week' && selectedWeek && selectedStudentId) {
      loadWeekAttendance(selectedWeek.startDateStr, selectedStudentId)
    }
  }, [selectedStudentId, selectedWeek, view])

  async function fetchStudents() {
    const { data } = await supabase.from('students').select('*').order('roll_no')
    if (data && data.length > 0) {
      setStudents(data)
      setSelectedStudentId(data[0].id)
    }
  }

  async function fetchAllAttendance() {
    const { data } = await supabase
      .from('attendance')
      .select('student_id, week_start, lesson_key, status')
    if (data) setAllAttendance(data)
  }

  async function loadWeekAttendance(weekStart, studentId) {
    if (!weekStart || !studentId) return
    setLoading(true)

    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('week_start', weekStart)
      .eq('student_id', studentId)

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
      alert('Attendance saved successfully!')
      fetchAllAttendance()
    }
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

  const navigateToHome = () => {
    setSelectedMonth(null)
    setSelectedWeek(null)
    setView('home')
  }

  const back =
    view === 'month' ? { action: navigateToHome, label: 'Back to Months' } :
      view === 'week' ? { action: () => setView('month'), label: 'Back to Weeks' } :
        view === 'advanced_stats' ? { action: () => setView('stats'), label: 'Back to Analytics' } :
          null

  return (
    <div className="shell">
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
                    onClick={() => { setSelectedMonth(m); setView('month'); }}
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

        {/* 2. MONTH VIEW: Weeks List */}
        {view === 'month' && selectedMonth && (
          <section className="view">
            <h2 className="section-title">{selectedMonth.name}</h2>
            <p className="section-sub">Select a week to log or review attendance:</p>

            <div className="week-list">
              {getWeeksForMonth(selectedMonth.year, selectedMonth.month).map(w => {
                const isCurrent = isCurrentWeek(w.startDateStr)
                return (
                  <button
                    key={w.startDateStr}
                    onClick={() => { setSelectedWeek(w); setView('week'); }}
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
          </section>
        )}

        {/* 3. WEEK VIEW */}
        {view === 'week' && selectedWeek && (
          <section className="view">
            <div className="week-header">
              <div className="week-header-range">
                <span className="week-header-eyebrow">Week Range</span>
                <h2 className="week-header-title">{selectedWeek.label}</h2>
              </div>
              <div className="week-header-select">
                <label className="select-label">Select Student</label>
                <select
                  value={selectedStudentId}
                  onChange={e => setSelectedStudentId(e.target.value)}
                  className="select"
                >
                  {students.map(s => (
                    <option key={s.id} value={s.id}>#{s.roll_no} — {s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="loading">Loading attendance records...</div>
            ) : (
              <>
                <div className="lesson-grid">
                  {LESSONS.map(lesson => {
                    const isFuture = isFutureLesson(selectedWeek?.startDateStr, lesson.day)

                    return (
                      <div key={lesson.id} className={`lesson-card ${isFuture ? 'disabled' : ''}`}>
                        <div className="lesson-top">
                          <div className="lesson-day">
                            {getFormattedLessonDate(selectedWeek?.startDateStr, lesson.day)}
                          </div>
                          <div className="lesson-time">{lesson.time}</div>
                          <span className="teacher-badge">{lesson.teacher}</span>
                        </div>

                        {isFuture ? (
                          <div className="future-tag">Future Lesson</div>
                        ) : (
                          <div className="status-row">
                            {[
                              { label: 'P', value: 'P', title: 'Present' },
                              { label: 'L', value: 'L', title: 'Late' },
                              { label: 'A', value: 'A', title: 'Absent' },
                              { label: 'N', value: 'N', title: 'No Class' }
                            ].map(opt => (
                              <button
                                key={opt.value}
                                onClick={() => setAttendance(prev => ({ ...prev, [lesson.id]: opt.value }))}
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

                <button onClick={handleSaveAttendance} className="submit-btn">
                  Save Attendance Record
                </button>
              </>
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

            <h2 className="section-title spaced">
              Class Lateness Overview
            </h2>
            <p className="section-sub">
              Lateness is calculated as late lessons divided by attended lessons (presents + lates).
            </p>

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
                    <option key={s.id} value={s.id}>#{s.roll_no} — {s.name}</option>
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