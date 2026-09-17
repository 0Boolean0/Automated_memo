/**
 * Purchase detail page.
 * Shows full PO info, line items, and all registered serial numbers.
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Tag } from 'lucide-react'
import toast from 'react-hot-toast'
import Badge from '@/components/ui/Badge'
import { purchaseService, type Purchase, type PurchaseSerial } from '@/services/purchaseService'
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format'

function paymentBadge(status: string) {
  const map: Record<string, 'green' | 'yellow' | 'red'> = { PAID: 'green', PARTIAL: 'yellow', DUE: 'red' }
  return map[status] ?? 'gray'
}

function serialBadge(status: string) {
  const map: Record<string, 'green' | 'blue' | 'yellow' | 'red' | 'purple' | 'gray'> = {
    IN_STOCK: 'green', SOLD: 'blue', RETURNED: 'yellow', DAMAGED: 'red',
    WARRANTY: 'purple', RESERVED: 'orange' as 'yellow', RECEIVED: 'gray',
  }
  return map[status] ?? 'gray'
}

export default function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [purchase, setPurchase]     = useState<Purchase | null>(null)
  const [serials, setSerials]       = useState<PurchaseSerial[]>([])
  const [loading, setLoading]       = useState(true)
  const [showSerials, setShowSerials] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      purchaseService.get(Number(id)),
      purchaseService.getSerials(Number(id)),
    ]).then(([p, s]) => {
      setPurchase(p)
      setSerials(s.serials)
    }).catch(() => {
      toast.error('Purchase not found')
      navigate('/purchases')
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-primary-500" /></div>
  if (!purchase) return null

  const due = Number(purchase.total_amount) - Number(purchase.paid_amount)

  return (
    <div className="max-w-4xl space-y-5">

      {/* Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/purchases')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 mt-0.5">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 font-mono">{purchase.purchase_number}</h1>
            <Badge variant={paymentBadge(purchase.payment_status)}>{purchase.payment_status}</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {purchase.supplier_name ?? 'Walk-in supplier'} · {formatDate(purchase.purchase_date)}
            {purchase.invoice_number && ` · Invoice: ${purchase.invoice_number}`}
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Amount', value: formatCurrency(purchase.total_amount), color: 'text-gray-900' },
          { label: 'Paid',         value: formatCurrency(purchase.paid_amount),  color: 'text-green-600' },
          { label: 'Due',          value: formatCurrency(due),                   color: due > 0 ? 'text-red-500' : 'text-gray-400' },
          { label: 'Serials',      value: String(serials.length),                color: 'text-blue-600' },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Line items */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-semibold text-gray-900">Items</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3 font-medium text-gray-600">Product / Variant</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">SKU</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Qty</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Unit Cost</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Total</th>
              <th className="text-left px-5 py-3 font-medium text-gray-600">Serials</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {purchase.items.map(item => (
              <tr key={item.id}>
                <td className="px-5 py-3.5">
                  <p className="font-medium text-gray-900">{item.product_name}</p>
                  <p className="text-xs text-gray-400">{item.variant_name}</p>
                </td>
                <td className="px-5 py-3.5 font-mono text-xs text-gray-500">{item.sku ?? '—'}</td>
                <td className="px-5 py-3.5 text-gray-700">{item.quantity}</td>
                <td className="px-5 py-3.5 text-gray-700">{formatCurrency(item.unit_cost)}</td>
                <td className="px-5 py-3.5 font-semibold text-gray-900">{formatCurrency(item.total_cost)}</td>
                <td className="px-5 py-3.5 text-gray-500">{item.serial_count}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t border-gray-200">
              <td colSpan={4} className="px-5 py-3 text-right font-semibold text-gray-700">Grand Total</td>
              <td className="px-5 py-3 font-bold text-gray-900">{formatCurrency(purchase.total_amount)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Serial numbers section */}
      {serials.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <button
            className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
            onClick={() => setShowSerials(!showSerials)}
          >
            <div className="flex items-center gap-2">
              <Tag size={16} className="text-blue-500" />
              <span className="font-semibold text-gray-900">Serial Numbers ({serials.length})</span>
            </div>
            <span className="text-xs text-primary-600">{showSerials ? 'Hide' : 'Show'}</span>
          </button>
          {showSerials && (
            <div className="px-5 pb-5 border-t border-gray-100">
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {serials.map(sn => (
                  <div key={sn.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <div>
                      <p className="font-mono text-sm font-medium text-gray-900">{sn.serial}</p>
                      <p className="text-xs text-gray-400">{sn.variant_name}</p>
                    </div>
                    <Badge variant={serialBadge(sn.status)}>{sn.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {purchase.notes && (
        <div className="card">
          <p className="text-xs text-gray-400 mb-1">Notes</p>
          <p className="text-sm text-gray-600">{purchase.notes}</p>
        </div>
      )}

      <p className="text-xs text-gray-400 text-right">
        Created {formatDateTime(purchase.created_at)}
      </p>
    </div>
  )
}
