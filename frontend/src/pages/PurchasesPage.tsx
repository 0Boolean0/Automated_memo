/**
 * Purchases list page.
 * Shows all purchase orders with status badges and links to detail/receive-stock.
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Loader2, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { purchaseService, type PurchaseListItem } from '@/services/purchaseService'
import { useAuthStore } from '@/services/authStore'
import { formatCurrency, formatDate } from '@/utils/format'

function paymentBadge(status: string) {
  const map: Record<string, 'green' | 'yellow' | 'red'> = {
    PAID: 'green', PARTIAL: 'yellow', DUE: 'red',
  }
  return map[status] ?? 'gray'
}

export default function PurchasesPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const canReceive = hasPermission('receive_stock')

  const [items, setItems]     = useState<PurchaseListItem[]>([])
  const [total, setTotal]     = useState(0)
  const [pages, setPages]     = useState(1)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await purchaseService.list({ page, per_page: 20 })
      setItems(res.items)
      setTotal(res.total)
      setPages(res.pages)
    } catch { /* interceptor */ }
    finally { setLoading(false) }
  }, [page])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Purchases</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} purchase orders</p>
        </div>
        {canReceive && (
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => navigate('/purchases/receive')}
          >
            <Plus size={16} /> Receive Stock
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-primary-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <ShoppingCart size={40} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">No purchases yet</p>
            {canReceive && (
              <button
                onClick={() => navigate('/purchases/receive')}
                className="mt-3 text-sm text-primary-600 hover:underline"
              >
                Receive your first stock
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium text-gray-600">PO Number</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Supplier</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Items</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Total</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Paid</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map(p => (
                    <tr
                      key={p.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/purchases/${p.id}`)}
                    >
                      <td className="px-5 py-3.5 font-mono text-sm text-primary-600 font-medium">
                        {p.purchase_number}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">{p.supplier_name ?? '—'}</td>
                      <td className="px-5 py-3.5 text-gray-500">{formatDate(p.purchase_date)}</td>
                      <td className="px-5 py-3.5 text-gray-700">{p.item_count}</td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900">{formatCurrency(p.total_amount)}</td>
                      <td className="px-5 py-3.5 text-gray-600">{formatCurrency(p.paid_amount)}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant={paymentBadge(p.payment_status)}>{p.payment_status}</Badge>
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
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-2 disabled:opacity-40">
                    <ChevronLeft size={15} />
                  </button>
                  <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-2 disabled:opacity-40">
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
