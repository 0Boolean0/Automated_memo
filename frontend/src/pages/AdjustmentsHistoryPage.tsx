/**
 * Adjustments history page — Phase 5.
 *
 * Shows paginated list of all stock adjustments with:
 * - Timestamp
 * - Adjustment type (with color coding)
 * - Product and variant name
 * - Quantity change
 * - Reason
 * - User who made adjustment
 */

import { useEffect, useState, useCallback } from 'react'
import { Plus, Loader2, RotateCcw, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import Badge from '@/components/ui/Badge'
import StockAdjustmentModal from '@/components/inventory/StockAdjustmentModal'
import inventoryService, { type AdjustmentResponse } from '@/services/inventoryService'
import { useAuthStore } from '@/services/authStore'
import { formatDate } from '@/utils/format'

const ADJUSTMENT_TYPE_COLORS: Record<string, 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'orange'> = {
  PHYSICAL_COUNT: 'blue',
  DAMAGE: 'red',
  LOSS: 'red',
  TRANSFER: 'purple',
  RETURN: 'green',
  CORRECTION: 'orange',
}

const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  PHYSICAL_COUNT: 'Physical Count',
  DAMAGE: 'Damage',
  LOSS: 'Loss',
  TRANSFER: 'Transfer',
  RETURN: 'Return',
  CORRECTION: 'Correction',
}

export default function AdjustmentsHistoryPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const canAdjust = hasPermission('adjust_inventory')

  const [adjustments, setAdjustments] = useState<AdjustmentResponse[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await inventoryService.listAdjustments({
        page,
        per_page: 20,
        adjustment_type: typeFilter || undefined,
      })
      setAdjustments(res.items)
      setTotal(res.total)
      setPages(res.pages)
    } catch { /* interceptor */ }
    finally { setLoading(false) }
  }, [page, typeFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // Filter adjustments by search term (client-side)
  const filteredAdjustments = adjustments.filter(adj =>
    !searchTerm ||
    adj.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    adj.variant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    adj.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    adj.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Adjustment History</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} adjustments recorded</p>
        </div>
        {canAdjust && (
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => setShowModal(true)}
          >
            <Plus size={16} /> New Adjustment
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search product, variant, reason…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <select
          className="input w-auto min-w-[150px]"
          value={typeFilter}
          onChange={e => {
            setTypeFilter(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All Types</option>
          {Object.entries(ADJUSTMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {(typeFilter || searchTerm) && (
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => {
              setTypeFilter('')
              setSearchTerm('')
              setPage(1)
            }}
          >
            <RotateCcw size={14} /> Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-primary-500" />
          </div>
        ) : filteredAdjustments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <RotateCcw size={40} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">No adjustments yet</p>
            {canAdjust && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-3 text-sm text-primary-600 hover:underline"
              >
                Record your first adjustment
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Date & Time</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Product / Variant</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Type</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-600">Quantity</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Reason</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredAdjustments.map(adj => (
                    <tr
                      key={adj.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/adjustments/${adj.id}`)}
                    >
                      <td className="px-5 py-3.5 text-gray-600 text-xs">
                        {formatDate(adj.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div>
                          <p className="font-medium text-gray-900">{adj.product_name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {adj.variant_name} {adj.sku && `• ${adj.sku}`}
                          </p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={ADJUSTMENT_TYPE_COLORS[adj.adjustment_type] || 'gray'}>
                          {ADJUSTMENT_TYPE_LABELS[adj.adjustment_type] || adj.adjustment_type}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold">
                        <span className={adj.quantity_change > 0 ? 'text-green-600' : 'text-red-600'}>
                          {adj.quantity_change > 0 ? '+' : ''}{adj.quantity_change}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-700 max-w-xs truncate">
                        {adj.reason}
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">
                        {adj.adjusted_by_username || '—'}
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
