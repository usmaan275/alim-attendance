import React, { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MONTHS, getWeeksForMonth, isCurrentWeek } from '../constants'
import { findMonth, monthKey } from '../utils/calendar'
import useSwipe from '../hooks/useSwipe'
import useAdminMode from '../hooks/useAdminMode'

// Weeks list for one month. Swipe left / right (or use the arrows) for the next / previous month.
export default function MonthPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { base } = useAdminMode()

  const selectedMonth = findMonth(searchParams.get('date'))
  const monthIndex = MONTHS.findIndex(m => m.name === selectedMonth.name)
  const [monthSlide, setMonthSlide] = useState(null) // direction the new list slides in from

  const canGoMonth = (dir) => (dir === 'next' ? monthIndex < MONTHS.length - 1 : monthIndex > 0)

  // "replace" so the browser back button still goes to the dashboard, not through every month you swiped past
  const goToMonth = (dir) => {
    const next = MONTHS[monthIndex + (dir === 'next' ? 1 : -1)]
    if (!next) return
    setMonthSlide(dir)
    navigate(`${base}/month?date=${monthKey(next)}`, { replace: true })
  }

  const monthSwipe = useSwipe({
    enabled: true,
    canGo: canGoMonth,
    onGo: goToMonth
  })

  return (
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
                onClick={() => navigate(`${base}/week?date=${w.startDateStr}`)}
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
  )
}