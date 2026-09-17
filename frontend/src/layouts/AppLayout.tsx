/**
 * Main application layout.
 * Wraps all authenticated pages. Redirects to /login if not authenticated.
 */

import { Outlet, Navigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import MobileNav from './MobileNav'
import { useAuthStore } from '@/services/authStore'

export default function AppLayout() {
  const { isAuthenticated } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  )
}
