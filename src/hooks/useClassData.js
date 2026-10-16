import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

// Students and attendance are loaded once in App.jsx and shared with every page
export const ClassDataContext = createContext(null)
export const useClassContext = () => useContext(ClassDataContext)

export default function useClassData() {
  const [students, setStudents] = useState([])
  const [selectedStudentId, setSelectedStudentId] = useState('')
  const [allAttendance, setAllAttendance] = useState([])
  const [attendanceLoading, setAttendanceLoading] = useState(true) // true while the stats data is being fetched
  const inFlight = useRef(null)

  async function fetchStudents() {
    const { data } = await supabase.from('students').select('*').order('roll_no')
    if (data && data.length > 0) {
      setStudents(data)
      setSelectedStudentId(data[0].id)
    }
  }

  async function loadAllAttendance() {
    setAttendanceLoading(true)

    // Supabase returns at most 1000 rows per request, so fetch the table in pages
    // (ordered by the unique key so pages never overlap or skip rows)
    const PAGE_SIZE = 1000
    let all = []
    let total = null

    while (total === null || all.length < total) {
      const { data, error, count } = await supabase
        .from('attendance')
        .select('student_id, week_start, lesson_key, status, online', { count: 'exact' })
        .order('week_start')
        .order('lesson_key')
        .order('student_id')
        .range(all.length, all.length + PAGE_SIZE - 1)

      if (error) {
        console.error('Error loading attendance:', error.message)
        setAttendanceLoading(false)
        return // keep the data we already had rather than showing partial numbers
      }
      if (total === null) total = count
      if (!data || data.length === 0) break
      all = all.concat(data)
    }

    setAllAttendance(all)
    setAttendanceLoading(false)
  }

  // If a fetch is already running, reuse it instead of starting another
  const refreshAttendance = useCallback(() => {
    if (!inFlight.current) {
      inFlight.current = loadAllAttendance().finally(() => { inFlight.current = null })
    }
    return inFlight.current
  }, [])

  useEffect(() => {
    fetchStudents()
    refreshAttendance()
  }, [refreshAttendance])

  return {
    students,
    selectedStudentId,
    setSelectedStudentId,
    allAttendance,
    attendanceLoading,
    refreshAttendance
  }
}