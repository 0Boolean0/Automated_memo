/**
 * Inventory dashboard page — Phase 5.
 *
 * Shows:
 * - Total stock across all variants
 * - Stock by category
 * - Stock by brand
 * - Recent adjustments
 * - Low-stock alerts
 */

import { useEffect, useState } from 'react'
import { AlertTriangle, Package, Loader2 } from 'lucide-react'
import { useAuthStore } from '@/services/authStore'
import inventoryService, { type LowStockAlert } from '@/services/inventoryService'
import { productService, type Product } from '@/services/productService'
import { formatCurrency } from '@/utils/format'

interface StockSummary {
  totalVariants: number
  totalStock: number
  totalValue: number
  categoryCounts: Record<string, { stock: number; value: number }>
  brandCounts: Record<string, { stock: number; value: number }>
}

export default function InventoryPage() {
  const { hasPermission } = useAuthStore()

  const [summary, setSummary] = useState<StockSummary | null>(null)
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInventory = async () => {
      setLoading(true)
      try {
        // Get all products to compute summary (paginate to get all)
        let allProducts: Product[] = []
        let page = 1
        let hasMore = true

        while (hasMore) {
          const result = await productService.list({ page, per_page: 100 })
          allProducts = allProducts.concat(result.items)
          hasMore = page < result.pages
          page++
        }

        const categoryCounts: Record<string, { stock: number; value: number }> = {}
        const brandCounts: Record<string, { stock: number; value: number }> = {}
        let totalStock = 0
        let totalValue = 0

        for (const product of allProducts) {
          const categoryName = product.category_name ?? 'Uncategorized'
          const brandName = product.brand_name ?? 'Unbranded'

          if (!categoryCounts[categoryName]) {
            categoryCounts[categoryName] = { stock: 0, value: 0 }
          }
          if (!brandCounts[brandName]) {
            brandCounts[brandName] = { stock: 0, value: 0 }
          }

          // Sum up stock from all variants
          for (const variant of product.variants ?? []) {
            const stock = variant.current_stock ?? 0
            const variantValue = stock * (Number(variant.selling_price) || 0)

            totalStock += stock
            totalValue += variantValue
            categoryCounts[categoryName].stock += stock
            categoryCounts[categoryName].value += variantValue
            brandCounts[brandName].stock += stock
            brandCounts[brandName].value += variantValue
          }
        }

        setSummary({
          totalVariants: allProducts.reduce(
            (sum, p) => sum + (p.variants?.length ?? 0),
            0
          ),
          totalStock,
          totalValue,
          categoryCounts,
          brandCounts,
        })

        // Get low-stock alerts
        const alerts = await inventoryService.getLowStockAlerts({ per_page: 10 })
        setLowStockAlerts(alerts.items)
      } catch (error) {
        console.error('Failed to fetch inventory:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchInventory()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={28} className="animate-spin text-primary-500" />
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Package size={40} className="text-gray-200 mb-3" />
        <p className="text-gray-500 font-medium">No inventory data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Inventory Dashboard</h2>
        <p className="text-sm text-gray-500 mt-0.5">Real-time stock overview and alerts</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-xs text-gray-500 font-medium">Total Variants</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totalVariants}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 font-medium">Total Stock</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.totalStock}</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 font-medium">Inventory Value</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            {formatCurrency(summary.totalValue)}
          </p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500 font-medium">Low Stock Alerts</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{lowStockAlerts.length}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">

        {/* Stock by Category */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Stock by Category</h3>
          <div className="space-y-3">
            {Object.entries(summary.categoryCounts)
              .sort(([, a], [, b]) => b.stock - a.stock)
              .map(([name, data]) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-700">{name}</p>
                    <p className="text-sm font-semibold text-gray-900">{data.stock} units</p>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-primary-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (data.stock / summary.totalStock) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{formatCurrency(data.value)}</p>
                </div>
              ))}
          </div>
        </div>

        {/* Stock by Brand */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Stock by Brand</h3>
          <div className="space-y-3">
            {Object.entries(summary.brandCounts)
              .sort(([, a], [, b]) => b.stock - a.stock)
              .map(([name, data]) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-gray-700">{name}</p>
                    <p className="text-sm font-semibold text-gray-900">{data.stock} units</p>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, (data.stock / summary.totalStock) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{formatCurrency(data.value)}</p>
                </div>
              ))}
          </div>
        </div>

      </div>

      {/* Low-stock alerts */}
      {lowStockAlerts.length > 0 && (
        <div className="card border-l-4 border-red-500 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-900">Low Stock Alerts</h3>
              <p className="text-sm text-red-700 mt-1">
                {lowStockAlerts.length} variant{lowStockAlerts.length !== 1 ? 's' : ''} below reorder level
              </p>
              <div className="mt-3 space-y-2">
                {lowStockAlerts.slice(0, 5).map((alert) => (
                  <div key={alert.variant_id} className="text-sm">
                    <p className="font-medium text-gray-900">
                      {alert.product_name} – {alert.variant_name}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {alert.current_stock} in stock, {alert.reorder_level} required
                      <span className="text-red-600 font-semibold ml-1">
                        ({alert.shortage} short)
                      </span>
                    </p>
                  </div>
                ))}
              </div>
              {lowStockAlerts.length > 5 && (
                <p className="text-xs text-red-600 font-semibold mt-2">
                  +{lowStockAlerts.length - 5} more alerts
                </p>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
