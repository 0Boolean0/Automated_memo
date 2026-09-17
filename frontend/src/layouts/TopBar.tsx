/**
 * Top navigation bar.
 * Shows the current page title and quick action icons.
 * Visible on both desktop and mobile.
 */

import { useLocation } from 'react-router-dom'
import { Bell, Menu } from 'lucide-react'
import { useAuthStore } from '@/services/authStore'

// Map route paths to human-readable page titles
const PAGE_TITLES: Record<string, string> = {
  '/dashboard':  'Dashboard',
  '/pos':        'New Sale',
  '/scan':       'Scan Product',
  '/products':   'Products',
  '/inventory':  'Inventory',
  '/purchases':  'Purchases',
  '/suppliers':  'Suppliers',
  '/customers':  'Customers',
  '/sales':      'Sales',
  '/invoices':   'Invoices',
  '/warranty':   'Warranty',
  '/returns':    'Returns',
  '/reports':    'Reports',
  '/users':      'User Management',
  '/backup':     'Backup & Restore',
  '/settings':   'Settings',
  '/more':       'Menu',
}

export default function TopBar() {
  const { pathname } = useLocation()
  const { user } = useAuthStore()

  // Find the matching page title (check exact match first, then prefix match)
  const title =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES).find(([path]) => pathname.startsWith(path))?.[1] ??
    'SmartStock'

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      {/* Left: Page title */}
      <div className="flex items-center gap-3">
        {/* Mobile menu icon — sidebar is hidden on mobile, so this is decorative for now */}
        <button className="md:hidden p-1 rounded text-gray-500 hover:text-gray-700">
          <Menu size={22} />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Notification bell (Phase 12) */}
        <button
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors relative"
          aria-label="Notifications"
        >
          <Bell size={20} />
          {/* Red dot for unread notifications — will be dynamic in Phase 12 */}
          {/* <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" /> */}
        </button>

        {/* User avatar / initials */}
        {user && (
          <div
            className="w-8 h-8 rounded-full bg-primary-600 text-white text-sm
                        font-medium flex items-center justify-center cursor-default"
            title={user.full_name || user.username}
          >
            {(user.full_name || user.username).charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </header>
  )
}
