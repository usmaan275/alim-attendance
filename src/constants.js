// src/constants.js

export const LESSONS = [
  { id: 'mon_1', day: 'Monday', time: '7:00-7:40', teacher: 'Ml Abubkr' },
  { id: 'mon_2', day: 'Monday', time: '7:40-9:00', teacher: 'Ml Raqib' },
  { id: 'tue_1', day: 'Tuesday', time: '7:00-8:00', teacher: 'Mufti Zubair' },
  { id: 'tue_2', day: 'Tuesday', time: '8:00-9:00', teacher: 'Mufti Zubair' },
  { id: 'wed_1', day: 'Wednesday', time: '7:00-7:40', teacher: 'Ml Abubkr' },
  { id: 'wed_2', day: 'Wednesday', time: '7:40-9:00', teacher: 'Ml Raqib' },
  { id: 'thu_1', day: 'Thursday', time: '7:00-7:40', teacher: 'Ml Abubkr' },
  { id: 'thu_2', day: 'Thursday', time: '7:40-9:00', teacher: 'Ml Raqib' },
  { id: 'fri_1', day: 'Friday', time: '6:15-7:15', teacher: 'Mufti Zubair' },
  { id: 'fri_2', day: 'Friday', time: '7:15-8:15', teacher: 'Ml Raqib' }
]

export const MONTHS = [
  { name: 'September 2026', year: 2026, month: 8 },
  { name: 'October 2026', year: 2026, month: 9 },
  { name: 'November 2026', year: 2026, month: 10 },
  { name: 'December 2026', year: 2026, month: 11 },
  { name: 'January 2027', year: 2027, month: 0 },
  { name: 'February 2027', year: 2027, month: 1 },
  { name: 'March 2027', year: 2027, month: 2 },
  { name: 'April 2027', year: 2027, month: 3 },
  { name: 'May 2027', year: 2027, month: 4 },
  { name: 'June 2027', year: 2027, month: 5 },
  { name: 'July 2027', year: 2027, month: 6 },
  { name: 'August 2027', year: 2027, month: 7 }
]

function toLocalDateStr(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function getWeeksForMonth(year, monthIndex) {
  const weeks = []
  
  const firstOfMonth = new Date(year, monthIndex, 1)
  const day = firstOfMonth.getDay()
  const diff = firstOfMonth.getDate() - day + (day === 0 ? -6 : 1)
  const currentMonday = new Date(year, monthIndex, diff)

  while (true) {
    const mon = new Date(currentMonday)
    const sun = new Date(currentMonday)
    sun.setDate(sun.getDate() + 6)

    // A week belongs to this month if Monday OR Sunday is inside the month
    const belongsToMonth = 
      (mon.getFullYear() === year && mon.getMonth() === monthIndex) ||
      (sun.getFullYear() === year && sun.getMonth() === monthIndex)

    if (belongsToMonth) {
      weeks.push({
        startDateStr: toLocalDateStr(mon),
        label: `${mon.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - ${sun.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
      })
    } else if (mon > new Date(year, monthIndex + 1, 1)) {
      break
    }

    currentMonday.setDate(currentMonday.getDate() + 7)
  }

  return weeks
}

export function getFormattedLessonDate(weekStartStr, dayName) {
  if (!weekStartStr) return dayName

  const dayOffsets = {
    'Monday': 0,
    'Tuesday': 1,
    'Wednesday': 2,
    'Thursday': 3,
    'Friday': 4,
    'Saturday': 5,
    'Sunday': 6
  }

  const offset = dayOffsets[dayName] ?? 0
  const [year, month, day] = weekStartStr.split('-').map(Number)
  const date = new Date(year, month - 1, day + offset)

  const dayNum = date.getDate()
  const suffix = (d) => {
    if (d > 3 && d < 21) return 'th'
    switch (d % 10) {
      case 1: return 'st'
      case 2: return 'nd'
      case 3: return 'rd'
      default: return 'th'
    }
  }

  return `${dayName} ${dayNum}${suffix(dayNum)}`
}

export function isFutureLesson(weekStartStr, dayName) {
  if (!weekStartStr) return false

  const dayOffsets = {
    'Monday': 0,
    'Tuesday': 1,
    'Wednesday': 2,
    'Thursday': 3,
    'Friday': 4,
    'Saturday': 5,
    'Sunday': 6
  }

  const offset = dayOffsets[dayName] ?? 0
  const [year, month, day] = weekStartStr.split('-').map(Number)
  const lessonDate = new Date(year, month - 1, day + offset)

  // Get current date at local midnight for accurate comparison
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return lessonDate > today
}

export function isCurrentMonth(year, monthIndex) {
  const today = new Date()
  return today.getFullYear() === year && today.getMonth() === monthIndex
}

export function isCurrentWeek(weekStartStr) {
  if (!weekStartStr) return false
  const today = new Date()
  
  // Calculate Monday of the current week
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1)
  const currentMonday = new Date(today.setDate(diff))
  
  const y = currentMonday.getFullYear()
  const m = String(currentMonday.getMonth() + 1).padStart(2, '0')
  const d = String(currentMonday.getDate()).padStart(2, '0')
  const currentMondayStr = `${y}-${m}-${d}`

  return weekStartStr === currentMondayStr
}