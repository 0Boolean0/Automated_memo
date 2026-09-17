/**
 * Dashboard page — placeholder for Phase 1.
 * Phase 12 will fill this with real charts and stats.
 */

import { Package, ShoppingCart, Shield, TrendingUp } from 'lucide-react'

// Placeholder stat cards — will be driven by real API data in Phase 12
const PLACEHOLDER_STATS = [
  { label: "Today's Sales",    value: '—',  icon: ShoppingCart, color: 'bg-blue-500' },
  { label: 'Total Products',   value: '—',  icon: Package,      color: 'bg-green-500' },
  { label: 'Active Warranty',  value: '—',  icon: Shield,       color: 'bg-purple-500' },
  { label: "Today's Revenue",  value: '—',  icon: TrendingUp,   color: 'bg-orange-500' },
]

export default function DashboardPage() {
  return (
    <div className="space-y-6">

      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white">
        <h2 className="text-xl font-semibold">Welcome to SmartStock</h2>
        <p className="text-primary-100 mt-1 text-sm">
          Phases 1–6 complete — inventory adjustments and barcode scanning are live.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {PLACEHOLDER_STATS.map((stat) => (
          <div key={stat.label} className="card flex items-center gap-4">
            <div className={`${stat.color} p-3 rounded-xl text-white flex-shrink-0`}>
              <stat.icon size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Phase checklist */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-4">Development Progress</h3>
        <ul className="space-y-2 text-sm">
          {[
            { phase: 'Phase 1',  label: 'Project setup, FastAPI, React, SQLite', done: true },
            { phase: 'Phase 2',  label: 'Authentication, Users, Roles', done: true },
            { phase: 'Phase 3',  label: 'Products, Variants, SKU, Barcode, Serial', done: true },
            { phase: 'Phase 4',  label: 'Suppliers, Purchases, Stock Receiving', done: true },
            { phase: 'Phase 5',  label: 'Inventory management', done: true },
            { phase: 'Phase 6',  label: 'Phone camera barcode scanner', done: true },
            { phase: 'Phase 7',  label: 'Customers', done: false },
            { phase: 'Phase 8',  label: 'POS / Sales', done: false },
            { phase: 'Phase 9',  label: 'Invoice / Memo PDF', done: false },
            { phase: 'Phase 10', label: 'Warranty tracking', done: false },
            { phase: 'Phase 11', label: 'Returns & Damaged products', done: false },
            { phase: 'Phase 12', label: 'Dashboard charts & Reports', done: false },
            { phase: 'Phase 13', label: 'Backup & Restore', done: false },
          ].map((item) => (
            <li key={item.phase} className="flex items-center gap-3">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                ${item.done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                {item.done ? '✓' : '○'}
              </span>
              <span className={`font-medium ${item.done ? 'text-green-700' : 'text-gray-500'}`}>
                {item.phase}
              </span>
              <span className="text-gray-500">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>

    </div>
  )
}
