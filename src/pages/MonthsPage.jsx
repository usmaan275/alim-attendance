import React from 'react'
import { useNavigate } from 'react-router-dom'
import { MONTHS, isCurrentMonth } from '../constants'
import { monthKey } from '../utils/calendar'
import useAdminMode from '../hooks/useAdminMode'

export default function MonthsPage() {
  const navigate = useNavigate()
  const { base } = useAdminMode()

  return (
    <section className="view">
      <h2 className="section-title">Select Month</h2>
      <div className="month-grid">
        {MONTHS.map(m => {
          const isCurrent = isCurrentMonth(m.year, m.month)
          return (
            <button
              key={m.name}
              onClick={() => navigate(`${base}/month?date=${monthKey(m)}`)}
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
  )
}