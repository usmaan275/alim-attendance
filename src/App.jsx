import React from 'react'
import { Outlet, ScrollRestoration, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import useClassData, { ClassDataContext } from './hooks/useClassData'
import useAdminMode from './hooks/useAdminMode'
import { findWeek, monthForWeek, monthKey } from './utils/calendar'
import './App.css'
import './swipe.css'
import './notes.css'

// Shared layout: back button, header and tabs stay put while the page below changes
export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { isAdmin, base } = useAdminMode()
  const classData = useClassData()

  // Current page without the /admin prefix: '/', '/month', '/week', '/stats' or '/stats/advanced'
  const page = (isAdmin ? location.pathname.replace(/^\/admin/, '') : location.pathname).replace(/\/+$/, '') || '/'

  // "Back" goes to the page its label names. If the history entry just below this one is exactly
  // that page (we opened this page from it), use browser back so the history stays tidy;
  // otherwise (typed URL, link from elsewhere) go straight to that page.
  const goBack = (parent) => {
    if (location.state && location.state.from === parent) navigate(-1)
    else navigate(parent, { replace: true })
  }

  let back = null
  if (page === '/month') {
    back = { label: 'Back to Months', action: () => goBack(base || '/') }
  } else if (page === '/week') {
    const fromMonth = location.state && location.state.from ? location.state.from.split('date=')[1] : null
    const parentMonth = monthKey(monthForWeek(findWeek(searchParams.get('date')), fromMonth))
    back = { label: 'Back to Weeks', action: () => goBack(`${base}/month?date=${parentMonth}`) }
  } else if (page === '/stats/advanced') {
    back = { label: 'Back to Analytics', action: () => goBack('/stats') }
  } else if (isAdmin && page === '/') {
    back = { label: 'Back to Dashboard', action: () => navigate('/') }
  }

  const goTab = (path) => {
    if (location.pathname !== path) navigate(path)
  }

  return (
    <div className={`shell ${isAdmin ? 'admin' : ''}`}>
      <div className="app">
        <div className="topbar">
          {back && (
            <button onClick={back.action} className="back-btn">
              &larr; {back.label}
            </button>
          )}
        </div>

        <header className="header">
          <div className="brand">
            <h1 className="title">Alim Class Year 5</h1>
            <p className="subtitle">Attendance Tracking System</p>
          </div>
          {!isAdmin && (
            <nav className="tabs">
              <button
                onClick={() => goTab('/')}
                className={`tab ${['/', '/month', '/week'].includes(page) ? 'active' : ''}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => goTab('/stats')}
                className={`tab ${page.startsWith('/stats') ? 'active' : ''}`}
              >
                Analytics &amp; Stats
              </button>
            </nav>
          )}
        </header>

        <ClassDataContext.Provider value={classData}>
          <Outlet />
        </ClassDataContext.Provider>
      </div>

      {/* Keeps your scroll position when you go back; swiping between weeks doesn't jump to the top */}
      <ScrollRestoration getKey={(loc) => loc.pathname} />
    </div>
  )
}