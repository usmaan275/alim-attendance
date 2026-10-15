import React, { useLayoutEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useClassContext } from '../hooks/useClassData'
import { attendanceTone, latenessTone, calculateClassStats, calculateLatenessStats } from '../utils/stats'
import Loading from '../components/Loading'

export default function StatsPage() {
  const navigate = useNavigate()
  const { students, allAttendance, attendanceLoading, refreshAttendance } = useClassContext()

  // Refresh the numbers every time this page is opened (runs before paint, so old numbers never flash)
  useLayoutEffect(() => {
    refreshAttendance()
  }, [refreshAttendance])

  // Show spinners until both the students and their attendance have loaded
  const statsLoading = attendanceLoading || students.length === 0

  return (
    <section className="view">
      <button
        onClick={() => navigate('/stats/advanced')}
        className="advanced-analytics-btn"
      >
        Deep Insights &amp; Advanced Filters &rarr;
      </button>
      <h2 className="section-title">Class Attendance Overview</h2>
      <p className="section-sub">
        Statistics are based on all marked sessions across the term. Attendance rate is calculated as attended lessons (presents + lates) divided by total marked sessions.
      </p>

      {statsLoading ? (
        <Loading className="table-loading" label="Loading attendance statistics..." />
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
              {calculateClassStats(students, allAttendance).map(s => (
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
        <Loading className="table-loading" label="Loading attendance statistics..." />
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
              {calculateLatenessStats(students, allAttendance).map(s => (
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
  )
}