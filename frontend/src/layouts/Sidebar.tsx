/**
 * Sidebar navigation — desktop only.
 * On mobile this is hidden; the bottom navigation bar takes over.
 */

import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  ScanLine,
  Package,
  Layers,
  Truck,
  Users,
  Building2,
  Shield,
  RotateCcw,
  BarChart3,
  Receipt,
  UserCog,
  Settings,
  Database,
  LogOut,
  Boxes,
  Tag,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'
import { useAuthStore } from '@/services/authStore'

// Each nav item: icon, label, path, optional required permission
interface NavItem {
  icon: React.ElementType
  label: string
  path: string
  permission?: string
  dividerBefore?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard',   path: '/dashboard' },
  { icon: ShoppingCart,    label: 'POS / New Sale', path: '/pos' },
  { icon: ScanLine,        label: 'Scan Product', path: '/scan' },

  { icon: Package,         label: 'Products',    path: '/products',   dividerBefore: true },
  { icon: Tag,             label: 'Categories & Brands', path: '/catalog' },
  { icon: Boxes,           label: 'Inventory',   path: '/inventory' },
  { icon: Layers,          label: 'Purchases',   path: '/purchases', permission: 'receive_stock' },
  { icon: Truck,           label: 'Suppliers',   path: '/suppliers',  permission: 'view_suppliers' },

  { icon: Users,           label: 'Customers',   path: '/customers',  dividerBefore: true },
  { icon: Receipt,         label: 'Sales',       path: '/sales' },
  { icon: Receipt,         label: 'Invoices',    path: '/invoices' },
  { icon: Shield,          label: 'Warranty',    path: '/warranty' },
  { icon: RotateCcw,       label: 'Returns',     path: '/returns',    permission: 'manage_returns' },

  { icon: BarChart3,       label: 'Reports',     path: '/reports',    permission: 'view_reports', dividerBefore: true },

  { icon: UserCog,         label: 'Users',       path: '/users',      permission: 'manage_users', dividerBefore: true },
  { icon: Database,        label: 'Backup',      path: '/backup',     permission: 'manage_backup' },
  { icon: Settings,        label: 'Settings',    path: '/settings' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout, hasPermission } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside
      className={`
        hidden md:flex flex-col bg-gray-900 text-white transition-all duration-200
        ${collapsed ? 'w-16' : 'w-60'}
        min-h-screen flex-shrink-0
      `}
    >
      {/* Logo / Brand */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              SS
            </div>
            <span className="font-bold text-lg tracking-tight">SmartStock</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center text-white font-bold text-sm mx-auto">
            SS
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors ml-auto"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation links */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          // Hide items the user doesn't have permission for
          if (item.permission && !hasPermission(item.permission)) return null

          return (
            <div key={item.path}>
              {item.dividerBefore && (
                <div className="my-2 border-t border-gray-700" />
              )}
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                   transition-colors duration-100 group
                   ${isActive
                     ? 'bg-primary-600 text-white'
                     : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                   }`
                }
                title={collapsed ? item.label : undefined}
              >
                <item.icon
                  size={18}
                  className="flex-shrink-0"
                />
                {!collapsed && (
                  <span className="truncate">{item.label}</span>
                )}
              </NavLink>
            </div>
          )
        })}
      </nav>

      {/* User info + logout */}
      <div className="border-t border-gray-700 p-3">
        {!collapsed && user && (
          <div className="mb-2 px-2">
            <p className="text-sm font-medium text-white truncate">
              {user.full_name || user.username}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {user.roles?.[0]?.name ?? 'User'}
            </p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm
                     text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut size={18} className="flex-shrink-0" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
