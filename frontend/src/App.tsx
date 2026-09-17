import { Routes, Route, Navigate } from 'react-router-dom'

import AppLayout         from '@/layouts/AppLayout'
import LoginPage         from '@/pages/LoginPage'
import DashboardPage     from '@/pages/DashboardPage'
import UsersPage         from '@/pages/UsersPage'
import SettingsPage      from '@/pages/SettingsPage'
import CatalogPage       from '@/pages/CatalogPage'
import ProductsPage      from '@/pages/ProductsPage'
import ProductDetailPage from '@/pages/ProductDetailPage'
import ComingSoon        from '@/components/ui/ComingSoon'

export default function App() {
  return (
    <Routes>

      {/* Public */}
      <Route path="/login"         element={<LoginPage />} />
      <Route path="/verify/:token" element={<ComingSoon page="Invoice Verification" phase="Phase 9" />} />

      {/* Root */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* Authenticated */}
      <Route element={<AppLayout />}>
        <Route path="/dashboard"       element={<DashboardPage />} />

        {/* Phase 2 */}
        <Route path="/users"           element={<UsersPage />} />
        <Route path="/settings"        element={<SettingsPage />} />

        {/* Phase 3 */}
        <Route path="/products"        element={<ProductsPage />} />
        <Route path="/products/:id"    element={<ProductDetailPage />} />
        <Route path="/catalog"         element={<CatalogPage />} />

        {/* Phases 4–13 placeholders */}
        <Route path="/pos"             element={<ComingSoon page="POS / New Sale"   phase="Phase 8" />} />
        <Route path="/scan"            element={<ComingSoon page="Scan Product"     phase="Phase 6" />} />
        <Route path="/inventory"       element={<ComingSoon page="Inventory"        phase="Phase 5" />} />
        <Route path="/purchases"       element={<ComingSoon page="Purchases"        phase="Phase 4" />} />
        <Route path="/suppliers"       element={<ComingSoon page="Suppliers"        phase="Phase 4" />} />
        <Route path="/customers"       element={<ComingSoon page="Customers"        phase="Phase 7" />} />
        <Route path="/sales"           element={<ComingSoon page="Sales"            phase="Phase 8" />} />
        <Route path="/invoices"        element={<ComingSoon page="Invoices"         phase="Phase 9" />} />
        <Route path="/warranty"        element={<ComingSoon page="Warranty"         phase="Phase 10" />} />
        <Route path="/returns"         element={<ComingSoon page="Returns"          phase="Phase 11" />} />
        <Route path="/reports"         element={<ComingSoon page="Reports"          phase="Phase 12" />} />
        <Route path="/backup"          element={<ComingSoon page="Backup & Restore" phase="Phase 13" />} />
        <Route path="/more"            element={<ComingSoon page="More"             phase="—" />} />
        <Route path="*"                element={<ComingSoon page="Page Not Found"   phase="—" />} />
      </Route>

    </Routes>
  )
}
