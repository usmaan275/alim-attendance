import { MONTHS, getWeeksForMonth, isCurrentMonth, isCurrentWeek } from '../constants'

// Every week of the term in order (a week that touches two months is listed once)
export const ALL_WEEKS = (() => {
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

// URL-friendly key for a month, e.g. "2026-09" (used in /month?date=2026-09)
export const monthKey = (m) => `${m.year}-${String(m.month + 1).padStart(2, '0')}`

// Month for a ?date= value; falls back to the current month, then the first month
export const findMonth = (key) =>
  MONTHS.find(m => monthKey(m) === key) ||
  MONTHS.find(m => isCurrentMonth(m.year, m.month)) ||
  MONTHS[0]

// Week for a ?date= value (the Monday, e.g. "2026-09-14"); falls back to the current week, then the first week
export const findWeek = (dateStr) =>
  ALL_WEEKS.find(w => w.startDateStr === dateStr) ||
  ALL_WEEKS.find(w => isCurrentWeek(w.startDateStr)) ||
  ALL_WEEKS[0]

// The month a week belongs to (used for the back-button fallback)
export const monthForWeek = (week) =>
  MONTHS.find(m => getWeeksForMonth(m.year, m.month).some(w => w.startDateStr === week.startDateStr)) ||
  MONTHS[0]