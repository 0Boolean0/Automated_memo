import { Routes, Route, Navigate } from 'react-router-dom'

import AppLayout                from '@/layouts/AppLayout'
import LoginPage                from '@/pages/LoginPage'
import DashboardPage            from '@/pages/DashboardPage'
import UsersPage                from '@/pages/UsersPage'
import SettingsPage             from '@/pages/SettingsPage'
import CatalogPage              from '@/pages/CatalogPage'
import ProductsPage             from '@/pages/ProductsPage'
import ProductDetailPage        from '@/pages/ProductDetailPage'
import SuppliersPage            from '@/pages/SuppliersPage'
import PurchasesPage            from '@/pages/PurchasesPage'
import ReceiveStockPage         from '@/pages/ReceiveStockPage'
import PurchaseDetailPage       from '@/pages/PurchaseDetailPage'
import InventoryPage            from '@/pages/InventoryPage'
import AdjustmentsHistoryPage   from '@/pages/AdjustmentsHistoryPage'
import LowStockAlertsPage       from '@/pages/LowStockAlertsPage'
import ScanPage                 from '@/pages/ScanPage'
import CustomersPage            from '@/pages/CustomersPage'
import POSPage                  from '@/pages/POSPage'
import SalesListPage            from '@/pages/SalesListPage'
import SaleDetailPage           from '@/pages/SaleDetailPage'
import InvoicesPage             from '@/pages/InvoicesPage'
import WarrantyPage             from '@/pages/WarrantyPage'
import ReturnsPage              from '@/pages/ReturnsPage'
import ReportsPage              from '@/pages/ReportsPage'
import ComingSoon               from '@/components/ui/ComingSoon'

export default function App() {
  return (
    <Routes>
      <Route path="/login"         element={<LoginPage />} />
      <Route path="/verify/:token" element={<ComingSoon page="Invoice Verification" phase="Phase 9" />} />
      <Route path="/"              element={<Navigate to="/dashboard" replace />} />

      <Route element={<AppLayout />}>
        <Route path="/dashboard"           element={<DashboardPage />} />

        {/* Phase 2 */}
        <Route path="/users"               element={<UsersPage />} />
        <Route path="/settings"            element={<SettingsPage />} />

        {/* Phase 3 */}
        <Route path="/products"            element={<ProductsPage />} />
        <Route path="/products/:id"        element={<ProductDetailPage />} />
        <Route path="/catalog"             element={<CatalogPage />} />

        {/* Phase 4 */}
        <Route path="/suppliers"           element={<SuppliersPage />} />
        <Route path="/purchases"           element={<PurchasesPage />} />
        <Route path="/purchases/receive"   element={<ReceiveStockPage />} />
        <Route path="/purchases/:id"       element={<PurchaseDetailPage />} />

        {/* Phase 5 — Inventory management */}
        <Route path="/inventory"              element={<InventoryPage />} />
        <Route path="/inventory/adjustments"  element={<AdjustmentsHistoryPage />} />
        <Route path="/inventory/alerts"       element={<LowStockAlertsPage />} />

        {/* Phase 5–13 placeholders */}
        <Route path="/pos"        element={<POSPage />} />
        <Route path="/scan"       element={<ScanPage />} />
        <Route path="/customers"  element={<CustomersPage />} />
        <Route path="/sales"      element={<SalesListPage />} />
        <Route path="/sales/:id"  element={<SaleDetailPage />} />
        <Route path="/invoices"   element={<InvoicesPage />} />
        <Route path="/warranty"   element={<WarrantyPage />} />
        <Route path="/returns"    element={<ReturnsPage />} />
        <Route path="/reports"    element={<ReportsPage />} />
        <Route path="/backup"     element={<ComingSoon page="Backup & Restore" phase="Phase 13" />} />
        <Route path="/more"       element={<ComingSoon page="More"             phase="—" />} />
        <Route path="*"           element={<ComingSoon page="Page Not Found"   phase="—" />} />
      </Route>
    </Routes>
  )
}
