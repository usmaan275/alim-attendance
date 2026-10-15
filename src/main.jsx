import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import MonthsPage from './pages/MonthsPage.jsx'
import MonthPage from './pages/MonthPage.jsx'
import WeekPage from './pages/WeekPage.jsx'
import StatsPage from './pages/StatsPage.jsx'
import AdvancedStatsPage from './pages/AdvancedStatsPage.jsx'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <MonthsPage /> },
      { path: 'month', element: <MonthPage /> },
      { path: 'week', element: <WeekPage /> },
      { path: 'stats', element: <StatsPage /> },
      { path: 'stats/advanced', element: <AdvancedStatsPage /> },

      // Hidden admin pages: the same pages, but week marks lessons as No Class for the whole class
      { path: 'admin', element: <MonthsPage /> },
      { path: 'admin/month', element: <MonthPage /> },
      { path: 'admin/week', element: <WeekPage /> },

      // Anything else goes back to the dashboard
      { path: '*', element: <Navigate to="/" replace /> }
    ]
  }
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)