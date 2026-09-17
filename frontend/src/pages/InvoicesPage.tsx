/**
 * Invoices page — Phase 9.
 *
 * Lists all sales with a "Download PDF" button per row.
 * Reuses the saleService list endpoint — every sale has an invoice.
 */

import { useEffect, useState, useCallback } from 'react'
import { Loader2, FileText, Download, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { saleService, type SaleListItem } from '@/services/saleService'
import { useAuthStore } from '@/services/authStore'
import { formatCurrency, formatDate } from '@/utils/format'
import api from '@/services/api'
import toast from 'react-hot-toast'

function paymentBadge(status: string): 'green' | 'yellow' | 'red' {
  return status === 'PAID' ? 'green' : status === 'PARTIAL' ? 'yellow' : 'red'
}

export default function InvoicesPage() {
  const { hasPermission } = useAuthStore()
  const canDownload = hasPermission('generate_invoice')

  const [items, setItems]               = useState<SaleListItem[]>([])
  const [total, setTotal]               = useState(0)
  const [pages, setPages]               = useState(1)
  const [page, setPage]                 = useState(1)
  const [loading, setLoading]           = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [downloading, setDownloading]   = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await saleService.list({
        payment_status: statusFilter || undefined,
        page,
        per_page: 20,
      })
      setItems(res.items)
      setTotal(res.total)
      setPages(res.pages)
    } catch { /* interceptor */ }
    finally { setLoading(false) }
  }, [page, statusFilter])

  useEffect(() => { setPage(1) }, [statusFilter])
  useEffect(() => { fetchData() }, [fetchData])

  const downloadInvoice = async (sale: SaleListItem) => {
    if (!canDownload) {
      toast.error('You do not have permission to download invoices')
      return
    }
    setDownloading(sale.id)
    try {
      // Fetch PDF as blob and trigger browser download
      const response = await api.get(`/sales/${sale.id}/invoice`, {
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `invoice_${sale.sale_number}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success(`Invoice ${sale.sale_number} downloaded`)
    } catch {
      toast.error('Failed to generate invoice')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Invoices</h2>
        <p className="text-sm text-gray-500 mt-0.5">{total} invoice{total !== 1 ? 's' : ''}</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          className="input w-auto min-w-[150px]"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="DUE">Due</option>
        </select>
        {statusFilter && (
          <button className="btn-secondary flex items-center gap-1.5" onClick={() => setStatusFilter('')}>
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
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText size={40} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">No invoices yet</p>
            <p className="text-xs text-gray-400 mt-1">Invoices are generated automatically for each sale.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Invoice #</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Customer</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-600">Net Total</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-600">Due</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                    {canDownload && <th className="px-5 py-3 text-center font-medium text-gray-600">PDF</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-sm text-primary-600 font-medium">
                        {s.sale_number}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {s.customer_name ?? <span className="text-gray-400">Walk-in</span>}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{formatDate(s.sale_date)}</td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900 text-right">
                        {formatCurrency(s.net_payable)}
                      </td>
                      <td className={`px-5 py-3.5 text-right font-medium ${s.due_amount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                        {s.due_amount > 0 ? formatCurrency(s.due_amount) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={paymentBadge(s.payment_status)}>{s.payment_status}</Badge>
                      </td>
                      {canDownload && (
                        <td className="px-5 py-3.5 text-center">
                          <button
                            onClick={() => downloadInvoice(s)}
                            disabled={downloading === s.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                                       bg-primary-50 text-primary-700 hover:bg-primary-100 transition-colors
                                       disabled:opacity-50 disabled:cursor-not-allowed"
                            title={`Download invoice ${s.sale_number}`}
                          >
                            {downloading === s.id
                              ? <Loader2 size={12} className="animate-spin" />
                              : <Download size={12} />
                            }
                            {downloading === s.id ? 'Generating…' : 'PDF'}
                          </button>
                        </td>
                      )}
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
