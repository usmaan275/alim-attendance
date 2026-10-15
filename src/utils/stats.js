import { LESSONS, MONTHS, getLessonDateObj } from '../constants'

// ---------- Advanced analytics filter options (derived from LESSONS) ----------
export const ALL_TEACHERS = 'All Teachers'
export const ALL_DAYS = 'All Days'
export const ALL_MONTHS = 'All Months'
export const TEACHERS = [ALL_TEACHERS, ...new Set(LESSONS.map(l => l.teacher))]
export const DAYS = [ALL_DAYS, ...new Set(LESSONS.map(l => l.day))]
export const LESSON_BY_ID = Object.fromEntries(LESSONS.map(l => [l.id, l]))

// ---------- Good / warn / bad thresholds (tweak these to taste) ----------
// Attendance rate: higher is better
const ATTENDANCE_GOOD = 70 // >= 70%  -> good
const ATTENDANCE_WARN = 50 // >= 50%  -> warn, below -> bad
// Lateness rate: lower is better
const LATENESS_GOOD = 20 // <= 20%  -> good
const LATENESS_WARN = 40 // <= 40%  -> warn, above -> bad

export const attendanceTone = (pct) => {
  if (pct === 'N/A') return 'neutral'
  const n = parseFloat(pct)
  if (n >= ATTENDANCE_GOOD) return 'good'
  if (n >= ATTENDANCE_WARN) return 'warn'
  return 'low'
}

export const latenessTone = (pct) => {
  if (pct === 'N/A') return 'neutral'
  const n = parseFloat(pct)
  if (n <= LATENESS_GOOD) return 'good'
  if (n <= LATENESS_WARN) return 'warn'
  return 'low'
}

// Counts P / L / A records and works out the attendance rate
export const tally = (records) => {
  const present = records.filter(a => a.status === 'P').length
  const late = records.filter(a => a.status === 'L').length
  const absent = records.filter(a => a.status === 'A').length
  const total = present + late + absent
  const attended = present + late
  const pct = total > 0 ? ((attended / total) * 100).toFixed(1) : 'N/A'
  return { present, late, absent, total, attended, pct }
}

// ---------- Stats page tables ----------
export function calculateClassStats(students, allAttendance) {
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

export function calculateLatenessStats(students, allAttendance) {
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
// Marked (P / A / L) records that match the student, teacher, month and day filters
export function filterRecords(allAttendance, { scope, teacher, month, day }) {
  return allAttendance.filter(a => {
    if (!['P', 'A', 'L'].includes(a.status)) return false
    if (scope !== 'ALL' && String(a.student_id) !== String(scope)) return false

    const lesson = LESSON_BY_ID[a.lesson_key]
    if (!lesson) return false
    if (teacher !== ALL_TEACHERS && lesson.teacher !== teacher) return false
    if (day !== ALL_DAYS && lesson.day !== day) return false

    if (month !== ALL_MONTHS) {
      const m = MONTHS.find(x => x.name === month)
      const dateObj = getLessonDateObj(a.week_start, lesson.day)
      if (!m || !dateObj) return false
      if (dateObj.getFullYear() !== m.year || dateObj.getMonth() !== m.month) return false
    }
    return true
  })
}

export function buildSummary(records) {
  const overall = tally(records)

  const punctualityPct = overall.attended > 0
    ? ((overall.present / overall.attended) * 100).toFixed(1)
    : 'N/A'

  // Day of the week with the most absences
  const absencesByDay = {}
  records
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

// Monthly breakdown: checks the exact date of each lesson record
export function getMonthAnalytics(records, year, monthIndex) {
  const monthRecords = records.filter(a => {
    const lesson = LESSON_BY_ID[a.lesson_key]
    if (!lesson) return false

    const dateObj = getLessonDateObj(a.week_start, lesson.day)
    if (!dateObj) return false

    // Matches exact year and month of the lesson itself
    return dateObj.getFullYear() === year && dateObj.getMonth() === monthIndex
  })

  return {
    ...tally(monthRecords),
    // Total lessons evaluated for this exact month
    total: monthRecords.length
  }
}