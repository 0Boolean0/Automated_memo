/**
 * Main application layout.
 * Wraps all authenticated pages with the sidebar, topbar, and mobile nav.
 *
 * Layout structure:
 *
 * ┌─────────────────────────────────────────────┐
 * │  Sidebar (desktop)  │  TopBar               │
 * │                     │─────────────────────── │
 * │                     │                        │
 * │                     │   Page Content         │
 * │                     │   (Outlet)             │
 * │                     │                        │
 * └─────────────────────┴────────────────────────┘
 *             ┌──────────────────────────┐
 *             │  Mobile Bottom Nav       │  ← only on small screens
 *             └──────────────────────────┘
 */

import { Outlet, Navigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import MobileNav from './MobileNav'
import { useAuthStore } from '@/services/authStore'

export default function AppLayout() {
  const { isAuthenticated } = useAuthStore()

  // If not logged in, redirect to login page.
  // This is the client-side guard — the backend always verifies tokens too.
  // NOTE: In Phase 1, authentication is not implemented yet.
  // The guard is active — use the "Dev Access" button on the login page,
  // or temporarily set isAuthenticated to true in authStore for local testing.
  // Phase 2 will implement real login.
  const isDev = import.meta.env.DEV
  if (!isAuthenticated && !isDev) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <TopBar />

        {/* Page content — each page renders here via React Router's Outlet */}
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileNav />
    </div>
  )
}
