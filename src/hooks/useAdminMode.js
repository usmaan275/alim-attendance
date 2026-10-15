import { useLocation } from 'react-router-dom'

// The hidden admin pages live under /admin (same pages, different behaviour)
export default function useAdminMode() {
  const { pathname } = useLocation()
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/')
  return { isAdmin, base: isAdmin ? '/admin' : '' }
}