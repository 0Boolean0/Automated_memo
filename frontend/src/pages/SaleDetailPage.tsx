/**
 * Sale detail page — Phase 8.
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Receipt, User, Star, Tag, Download, Printer } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { saleService, type Sale, type SaleSerial } from '@/services/saleService'
import { useAuthStore } from '@/services/authStore'
import { formatCurrency, formatDate } from '@/utils/format'
import api from '@/services/api'
import toast from 'react-hot-toast'

function paymentBadge(status: string): 'green' | 'yellow' | 'red' {
  return status === 'PAID' ? 'green' : status === 'PARTIAL' ? 'yellow' : 'red'
}

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const canDownload = hasPermission('generate_invoice')

  const [sale, setSale]             = useState<Sale | null>(null)
  const [serials, setSerials]       = useState<SaleSerial[]>([])
  const [loading, setLoading]       = useState(true)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    if (!id) return
    const saleId = Number(id)
    Promise.all([saleService.get(saleId), saleService.getSerials(saleId)])
      .then(([s, sr]) => { setSale(s); setSerials(sr.serials) })
      .catch(() => navigate('/sales'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
  }
  if (!sale) return null

  const hasSerials = serials.length > 0

  const downloadPDF = async () => {
    setDownloading(true)
    try {
      const response = await api.get(`/sales/${sale.id}/invoice`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `invoice_${sale.sale_number}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Invoice downloaded')
    } catch {
      toast.error('Failed to generate invoice')
    } finally {
      setDownloading(false)
    }
  }

  const printPDF = async () => {
    setDownloading(true)
    try {
      const response = await api.get(`/sales/${sale.id}/invoice`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const win = window.open(url, '_blank')
      if (win) win.onload = () => { win.print(); window.URL.revokeObjectURL(url) }
      else { window.URL.revokeObjectURL(url); toast.error('Allow pop-ups to print') }
    } catch {
      toast.error('Failed to generate invoice')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/sales')} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold text-gray-900 font-mono">{sale.sale_number}</h2>
            <Badge variant={paymentBadge(sale.payment_status)}>{sale.payment_status}</Badge>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{formatDate(sale.sale_date)}</p>
        </div>
        {canDownload && (
          <div className="flex gap-2">
            <button
              onClick={printPDF}
              disabled={downloading}
              className="btn-secondary flex items-center gap-2 text-sm"
              title="Open PDF and print"
            >
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
              Print
            </button>
            <button
              onClick={downloadPDF}
              disabled={downloading}
              className="btn-primary flex items-center gap-2 text-sm"
              title="Download invoice PDF"
            >
              {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              Invoice PDF
            </button>
          </div>
        )}
      </div>

      {/* Customer + payment summary */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Customer */}
        <div className="card space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Customer</p>
          {sale.customer_name ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center text-primary-500 font-bold">
                {sale.customer_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-gray-900">{sale.customer_name}</p>
                {sale.customer_phone && <p className="text-sm text-gray-500">{sale.customer_phone}</p>}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-400">
              <User size={18} />
              <span className="text-sm">Walk-in customer</span>
            </div>
          )}
          {(sale.loyalty_points_earned > 0 || sale.loyalty_points_redeemed > 0) && (
            <div className="pt-1 border-t border-gray-100 space-y-0.5 text-xs text-gray-500">
              {sale.loyalty_points_redeemed > 0 && (
                <p className="flex items-center gap-1">
                  <Star size={11} className="text-yellow-400" />
                  {sale.loyalty_points_redeemed} pts redeemed (−{formatCurrency(sale.loyalty_points_redeemed * 0.10)})
                </p>
              )}
              {sale.loyalty_points_earned > 0 && (
                <p className="flex items-center gap-1 text-green-600">
                  <Star size={11} className="text-yellow-400" />
                  +{sale.loyalty_points_earned} pts earned
                </p>
              )}
            </div>
          )}
        </div>

        {/* Payment */}
        <div className="card space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Payment</p>
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium">{formatCurrency(sale.total_amount)}</span>
            </div>
            {Number(sale.discount_amount) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>−{formatCurrency(sale.discount_amount)}</span>
              </div>
            )}
            {sale.loyalty_points_redeemed > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Loyalty ({sale.loyalty_points_redeemed} pts)</span>
                <span>−{formatCurrency(sale.loyalty_points_redeemed * 0.10)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold border-t border-gray-100 pt-1.5">
              <span>Net Payable</span>
              <span>{formatCurrency(sale.net_payable)}</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>Paid</span>
              <span>{formatCurrency(sale.paid_amount)}</span>
            </div>
            {sale.due_amount > 0 && (
              <div className="flex justify-between text-red-600 font-semibold">
                <span>Due</span>
                <span>{formatCurrency(sale.due_amount)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <Receipt size={16} className="text-gray-400" />
          <p className="font-semibold text-sm text-gray-700">Items ({sale.items.length})</p>
        </div>
        <div className="divide-y divide-gray-50">
          {sale.items.map(item => (
            <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{item.product_name}</p>
                <p className="text-xs text-gray-500">{item.variant_name}{item.sku ? ` · ${item.sku}` : ''}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(item.total_price)}</p>
                <p className="text-xs text-gray-400">{item.quantity} × {formatCurrency(item.unit_price)}</p>
                {Number(item.discount_amount) > 0 && (
                  <p className="text-xs text-green-600">−{formatCurrency(item.discount_amount)} disc.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Serials */}
      {hasSerials && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <Tag size={16} className="text-gray-400" />
            <p className="font-semibold text-sm text-gray-700">Serial Numbers ({serials.length})</p>
          </div>
          <div className="divide-y divide-gray-50">
            {serials.map(sn => (
              <div key={sn.id} className="px-4 py-2.5 flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm font-medium text-gray-900">{sn.serial}</p>
                  <p className="text-xs text-gray-400">{sn.variant_name}</p>
                </div>
                <div className="text-right">
                  <Badge variant="green">{sn.status}</Badge>
                  {sn.sold_at && <p className="text-xs text-gray-400 mt-1">{formatDate(sn.sold_at)}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {sale.notes && (
        <div className="card bg-gray-50">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
          <p className="text-sm text-gray-700">{sale.notes}</p>
        </div>
      )}
    </div>
  )
}
