import { LESSONS, MONTHS, getLessonDateObj } from '../constants'
import { ALL_WEEKS } from './calendar'

const toDateStr = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

// The Monday of the week containing a date, as YYYY-MM-DD (weeks start on Monday)
export function mondayOf(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = d.getDay()
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1))
  return toDateStr(d)
}

// "2026-10-19" -> "19 Oct - 25 Oct" (Monday to Sunday)
export function formatWeekRange(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const format = (date) => date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${format(new Date(y, m - 1, d))} - ${format(new Date(y, m - 1, d + 6))}`
}

/**
 * For each student, the past weeks (before the current week) where at least one lesson
 * has no P, L, A or N record. Only counts from the first week anyone recorded, and only
 * lessons that fall inside the school year. Weeks cancelled in /admin have N rows for
 * everyone, so they count as complete.
 * Returns [{ student, weeks: ['2026-10-05', ...] }] for students with something missing.
 */
export function findIncompleteWeeks(students, allAttendance, today = new Date()) {
  if (students.length === 0 || allAttendance.length === 0) return []

  const thisMonday = mondayOf(today)
  const firstRecorded = allAttendance.reduce(
    (min, a) => (a.week_start < min ? a.week_start : min),
    allAttendance[0].week_start
  )

  const recorded = new Set(
    allAttendance
      .filter(a => ['P', 'L', 'A', 'N'].includes(a.status))
      .map(a => `${a.student_id}_${a.week_start}_${a.lesson_key}`)
  )

  const termMonths = new Set(MONTHS.map(m => `${m.year}-${m.month}`))
  const lessonsInTerm = (weekStart) => LESSONS.filter(l => {
    const d = getLessonDateObj(weekStart, l.day)
    return termMonths.has(`${d.getFullYear()}-${d.getMonth()}`)
  })

  const pastWeeks = ALL_WEEKS
    .filter(w => w.startDateStr < thisMonday && w.startDateStr >= firstRecorded)
    .map(w => ({ weekStart: w.startDateStr, lessons: lessonsInTerm(w.startDateStr) }))

  return students
    .map(student => ({
      student,
      weeks: pastWeeks
        .filter(w => w.lessons.some(l => !recorded.has(`${student.id}_${w.weekStart}_${l.id}`)))
        .map(w => w.weekStart)
    }))
    .filter(item => item.weeks.length > 0)
}