/**
 * Root application component.
 * Defines all routes using React Router v6.
 *
 * Route structure:
 * - /login               → LoginPage (no auth required)
 * - /                    → redirect to /dashboard
 * - /verify/:token       → public invoice verification (no auth required)
 * - /*                   → AppLayout (requires auth) → child pages
 */

import { Routes, Route, Navigate } from 'react-router-dom'

// Layout
import AppLayout from '@/layouts/AppLayout'

// Pages
import LoginPage    from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import ComingSoon   from '@/components/ui/ComingSoon'

export default function App() {
  return (
    <Routes>

      {/* ── Public routes (no login required) ──────────────────────────── */}
      <Route path="/login" element={<LoginPage />} />

      {/* Public invoice verification — customers can check warranty/invoice */}
      <Route
        path="/verify/:token"
        element={<ComingSoon page="Invoice Verification" phase="Phase 9" />}
      />

      {/* ── Root redirect ───────────────────────────────────────────────── */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* ── Authenticated routes (AppLayout checks auth) ────────────────── */}
      <Route element={<AppLayout />}>
        <Route path="/dashboard"  element={<DashboardPage />} />

        {/* These will be replaced with real pages in their respective phases */}
        <Route path="/pos"        element={<ComingSoon page="POS / New Sale"    phase="Phase 8" />} />
        <Route path="/scan"       element={<ComingSoon page="Scan Product"      phase="Phase 6" />} />
        <Route path="/products"   element={<ComingSoon page="Products"          phase="Phase 3" />} />
        <Route path="/inventory"  element={<ComingSoon page="Inventory"         phase="Phase 5" />} />
        <Route path="/purchases"  element={<ComingSoon page="Purchases"         phase="Phase 4" />} />
        <Route path="/suppliers"  element={<ComingSoon page="Suppliers"         phase="Phase 4" />} />
        <Route path="/customers"  element={<ComingSoon page="Customers"         phase="Phase 7" />} />
        <Route path="/sales"      element={<ComingSoon page="Sales"             phase="Phase 8" />} />
        <Route path="/invoices"   element={<ComingSoon page="Invoices"          phase="Phase 9" />} />
        <Route path="/warranty"   element={<ComingSoon page="Warranty"          phase="Phase 10" />} />
        <Route path="/returns"    element={<ComingSoon page="Returns"           phase="Phase 11" />} />
        <Route path="/reports"    element={<ComingSoon page="Reports"           phase="Phase 12" />} />
        <Route path="/users"      element={<ComingSoon page="User Management"   phase="Phase 2" />} />
        <Route path="/backup"     element={<ComingSoon page="Backup & Restore"  phase="Phase 13" />} />
        <Route path="/settings"   element={<ComingSoon page="Settings"          phase="Phase 2" />} />
        <Route path="/more"       element={<ComingSoon page="More"              phase="Phase 2" />} />

        {/* 404 within app */}
        <Route path="*" element={<ComingSoon page="Page Not Found" phase="—" />} />
      </Route>

    </Routes>
  )
}
