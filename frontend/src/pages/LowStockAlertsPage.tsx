/**
 * Low-stock alerts page — Phase 5.
 *
 * Shows paginated list of all variants below their reorder level with:
 * - Product and variant name
 * - Current stock
 * - Reorder level
 * - Shortage (gap between current and reorder level)
 * - Cost and selling prices
 * - Action to record adjustment or create purchase
 */

import { useEffect, useState, useCallback } from 'react'
import { Loader2, AlertTriangle, ChevronLeft, ChevronRight, Plus, ShoppingCart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Badge from '@/components/ui/Badge'
import StockAdjustmentModal from '@/components/inventory/StockAdjustmentModal'
import inventoryService, { type LowStockAlert } from '@/services/inventoryService'
import { useAuthStore } from '@/services/authStore'
import { formatCurrency } from '@/utils/format'

export default function LowStockAlertsPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const canAdjust = hasPermission('adjust_inventory')
  const canReceive = hasPermission('receive_stock')

  const [alerts, setAlerts] = useState<LowStockAlert[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await inventoryService.getLowStockAlerts({
        page,
        per_page: 20,
      })
      setAlerts(res.items)
      setTotal(res.total)
      setPages(res.pages)
    } catch { /* interceptor */ }
    finally { setLoading(false) }
  }, [page])

  useEffect(() => { fetchData() }, [fetchData])

  // Urgency color: more shortage = more red
  const getUrgencyColor = (shortage: number, reorderLevel: number): 'red' | 'yellow' | 'orange' => {
    const percentageBelow = (shortage / reorderLevel) * 100
    if (percentageBelow >= 100) return 'red'      // Out of stock or negative
    if (percentageBelow >= 50) return 'red'       // Very critical
    if (percentageBelow >= 25) return 'orange'    // Critical
    return 'yellow'                                // Warning
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Low Stock Alerts</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} variant{total !== 1 ? 's' : ''} below reorder level
          </p>
        </div>
        {canReceive && (
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => navigate('/purchases/receive')}
          >
            <ShoppingCart size={16} /> Receive Stock
          </button>
        )}
      </div>

      {/* Alert banner */}
      {total > 0 && (
        <div className="card border-l-4 border-yellow-500 bg-yellow-50">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-yellow-900">Action needed</p>
              <p className="text-sm text-yellow-800 mt-0.5">
                {total} product variant{total !== 1 ? 's are' : ' is'} at or below reorder level.
                Consider receiving stock or recording adjustments.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-primary-500" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <ShoppingCart size={40} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">All variants well-stocked</p>
            <p className="text-xs text-gray-500 mt-1">Great news! No low stock alerts.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Product / Variant</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-600">Current</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-600">Reorder</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-600">Shortage</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-600">Cost</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-600">Sell</th>
                    <th className="text-center px-5 py-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {alerts.map(alert => (
                    <tr key={alert.variant_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div>
                          <p className="font-medium text-gray-900">{alert.product_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {alert.variant_name} {alert.sku && `• ${alert.sku}`}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-gray-900">
                        {alert.current_stock}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-gray-900">
                        {alert.reorder_level}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Badge variant={getUrgencyColor(alert.shortage, alert.reorder_level)}>
                          −{alert.shortage}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right text-gray-600">
                        {formatCurrency(alert.cost_price)}
                      </td>
                      <td className="px-5 py-3.5 text-right text-gray-600">
                        {formatCurrency(alert.selling_price)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex gap-2 justify-center">
                          {canAdjust && (
                            <button
                              onClick={() => setShowModal(true)}
                              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                              title="Record adjustment"
                            >
                              Adjust
                            </button>
                          )}
                          {canReceive && (
                            <button
                              onClick={() => navigate('/purchases/receive')}
                              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                              title="Receive stock"
                            >
                              Receive
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500">Page {page} of {pages} — {total} total</p>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="btn-secondary py-1 px-2 disabled:opacity-40"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    disabled={page >= pages}
                    onClick={() => setPage(p => p + 1)}
                    className="btn-secondary py-1 px-2 disabled:opacity-40"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal */}
      <StockAdjustmentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onAdjusted={() => {
          setPage(1)
          fetchData()
        }}
      />

    </div>
  )
}
