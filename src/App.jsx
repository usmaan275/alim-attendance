import React, { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import { LESSONS, MONTHS, getWeeksForMonth } from './constants'
import './App.css'

export default function App() {
  const [view, setView] = useState('home') // 'home' | 'month' | 'week' | 'stats'
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [selectedWeek, setSelectedWeek] = useState(null)
  const [students, setStudents] = useState([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [attendance, setAttendance] = useState({})
  const [allAttendance, setAllAttendance] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchStudents()
    fetchAllAttendance()
  }, [])

  async function fetchStudents() {
    const { data } = await supabase.from('students').select('*').order('roll_no')
    if (data && data.length > 0) {
      setStudents(data)
      setSelectedStudentId(data[0].id)
    }
  }

  async function fetchAllAttendance() {
    const { data } = await supabase.from('attendance').select('*')
    if (data) setAllAttendance(data)
  }

  async function loadWeekAttendance(weekStart, studentId) {
    setLoading(true)
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('week_start', weekStart)
      .eq('student_id', studentId)

    const initial = {}
    LESSONS.forEach(l => { initial[l.id] = 'P' })
    if (data) {
      data.forEach(item => {
        initial[item.lesson_key] = item.status
      })
    }
    setAttendance(initial)
    setLoading(false)
  }

  const handleStudentChange = (studentId) => {
    setSelectedStudentId(studentId)
    if (selectedWeek) {
      loadWeekAttendance(selectedWeek.startDateStr, studentId)
    }
  }

  const handleSaveAttendance = async () => {
    if (!selectedStudentId || !selectedWeek) return
    setLoading(true)

    const updates = LESSONS.map(lesson => ({
      student_id: selectedStudentId,
      week_start: selectedWeek.startDateStr,
      lesson_key: lesson.id,
      status: attendance[lesson.id] || 'P'
    }))

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
    if (students.length === 0 || allAttendance.length === 0) return []

    const markedSessions = new Set(
      allAttendance.filter(a => ['P', 'A', 'L'].includes(a.status)).map(a => `${a.week_start}_${a.lesson_key}`)
    )
    const denominator = markedSessions.size

    return students.map(s => {
      const studentRecords = allAttendance.filter(
        a => a.student_id === s.id && ['P', 'A', 'L'].includes(a.status)
      )
      const presentCount = studentRecords.filter(a => a.status === 'P' || a.status === 'L').length
      const pct = denominator > 0 ? ((presentCount / denominator) * 100).toFixed(1) : '100.0'

      return {
        ...s,
        presentCount,
        denominator,
        pct
      }
    })
  }

  // Back button config: always rendered in the same top-left slot
  const back =
    view === 'month' ? { to: 'home', label: 'Back to Months' } :
    view === 'week' ? { to: 'month', label: 'Back to Weeks' } :
    view === 'stats' ? { to: 'home', label: 'Back to Dashboard' } :
    null

  return (
    <div className="shell">
      <div className="app">
        {/* Top bar: fixed slot, back button always top-left */}
        <div className="topbar">
          {back && (
            <button onClick={() => setView(back.to)} className="back-btn">
              &larr; {back.label}
            </button>
          )}
        </div>

        {/* Header */}
        <header className="header">
          <div className="brand">
            <h1 className="title">Alim Class Year 5</h1>
            <p className="subtitle">Attendance Tracking System</p>
          </div>
          <nav className="tabs">
            <button
              onClick={() => setView('home')}
              className={`tab ${view === 'home' || view === 'month' || view === 'week' ? 'active' : ''}`}
            >
              Dashboard
            </button>
            <button
              onClick={() => { fetchAllAttendance(); setView('stats'); }}
              className={`tab ${view === 'stats' ? 'active' : ''}`}
            >
              Analytics &amp; Stats
            </button>
          </nav>
        </header>

        {/* 1. HOME VIEW: Month Grid (3 columns x 4 rows) */}
        {view === 'home' && (
          <section className="view">
            <h2 className="section-title">Select Month</h2>
            <div className="month-grid">
              {MONTHS.map(m => (
                <button
                  key={m.name}
                  onClick={() => { setSelectedMonth(m); setView('month'); }}
                  className="month-card"
                >
                  <span className="month-name">{m.name.split(' ')[0]}</span>
                  <span className="month-year">{m.name.split(' ')[1]}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 2. MONTH VIEW: Weeks List */}
        {view === 'month' && selectedMonth && (
          <section className="view">
            <h2 className="section-title">{selectedMonth.name}</h2>
            <p className="section-sub">Select a week to log or review attendance:</p>

            <div className="week-list">
              {getWeeksForMonth(selectedMonth.year, selectedMonth.month).map(w => (
                <button
                  key={w.startDateStr}
                  onClick={() => { setSelectedWeek(w); setView('week'); loadWeekAttendance(w.startDateStr, selectedStudentId); }}
                  className="week-card"
                >
                  <span className="week-card-text">
                    <span className="week-card-label">Week Beginning</span>
                    <span className="week-card-value">{w.label}</span>
                  </span>
                  <span className="week-card-arrow">&rarr;</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* 3. WEEK VIEW: Lessons grid (2 columns x 5 rows) */}
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
                  onChange={e => handleStudentChange(e.target.value)}
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
                  {LESSONS.map(lesson => (
                    <div key={lesson.id} className="lesson-card">
                      <div className="lesson-top">
                        <div className="lesson-day">{lesson.day}</div>
                        <div className="lesson-time">{lesson.time}</div>
                        <span className="teacher-badge">{lesson.teacher}</span>
                      </div>

                      <div className="status-row">
                        {[
                          { label: 'P', value: 'P', title: 'Present' },
                          { label: 'A', value: 'A', title: 'Absent' },
                          { label: 'L', value: 'L', title: 'Late' },
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
                    </div>
                  ))}
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
            <h2 className="section-title">Class Attendance Overview</h2>
            <p className="section-sub">
              Statistics are based on all marked sessions across the term.
            </p>

            <div className="table-wrap">
              <table className="table">
                <colgroup>
                  <col style={{ width: '17%' }} />
                  <col style={{ width: '35%' }} />
                  <col style={{ width: '28%' }} />
                  <col style={{ width: '20%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Student Name</th>
                    <th>Attended / Total</th>
                    <th>Attendance Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {calculateClassStats().map(s => (
                    <tr key={s.id}>
                      <td><span className="roll-badge">#{s.roll_no}</span></td>
                      <td className="student-name"><span>{s.name}</span></td>
                      <td className="attended">{s.presentCount} / {s.denominator} lessons</td>
                      <td>
                        <span className={`pct-badge ${parseFloat(s.pct) >= 80 ? 'good' : 'low'}`}>
                          {s.pct}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}