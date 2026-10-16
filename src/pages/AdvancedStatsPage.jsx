import React, { useState } from 'react'
import { MONTHS } from '../constants'
import { useClassContext } from '../hooks/useClassData'
import {
  ALL_TEACHERS, ALL_DAYS, ALL_MONTHS, TEACHERS, DAYS,
  attendanceTone, latenessTone, filterRecords, buildSummary, getMonthAnalytics, countTotalLessons
} from '../utils/stats'

export default function AdvancedStatsPage() {
  const { students, allAttendance } = useClassContext()

  // Filters
  const [analyticsScope, setAnalyticsScope] = useState('ALL')
  const [selectedTeacher, setSelectedTeacher] = useState(ALL_TEACHERS)
  const [analyticsMonth, setAnalyticsMonth] = useState(ALL_MONTHS)
  const [selectedDay, setSelectedDay] = useState(ALL_DAYS)

  const filteredRecords = filterRecords(allAttendance, {
    scope: analyticsScope,
    teacher: selectedTeacher,
    month: analyticsMonth,
    day: selectedDay
  })
  const summary = buildSummary(filteredRecords)

  // Total lessons ignores the student filter but follows teacher, month and day
  const totalLessons = countTotalLessons(allAttendance, {
    teacher: selectedTeacher,
    month: analyticsMonth,
    day: selectedDay
  })

  const punctualityTone = summary.punctualityPct === 'N/A'
    ? 'neutral'
    : latenessTone(100 - parseFloat(summary.punctualityPct))

  return (
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
          <span className="summary-title">Online Attendance</span>
          <span className="summary-value online">
            {summary.onlinePct}{summary.onlinePct !== 'N/A' && '%'}
          </span>
          <span className="summary-sub">Online vs attended lessons</span>
        </div>

        <div className="summary-card">
          <span className="summary-title">Total Lessons This Year</span>
          <span className="summary-value neutral">{totalLessons}</span>
          <span className="summary-sub">Total amount of lessons</span>
        </div>

        <div className="summary-card">
          <span className="summary-title">Total Evaluations</span>
          <span className="summary-value neutral">{summary.totalRecorded}</span>
          <span className="summary-sub">Total marked entries</span>
        </div>
      </div>

      {/* Monthly Grid 3x4 */}
      <h3 className="section-subtitle">Monthly Breakdown</h3>
      <div className="month-grid analytics-month-grid">
        {MONTHS.map(m => {
          const monthStats = getMonthAnalytics(filteredRecords, m.year, m.month)
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
  )
}