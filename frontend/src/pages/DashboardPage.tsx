/**
 * Dashboard page — Phase 12.
 * Real stats from /reports/summary + phase checklist.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ShoppingCart, Package, Shield, TrendingUp,
  AlertTriangle, RotateCcw, Loader2, ScanLine,
} from 'lucide-react'
import Badge from '@/components/ui/Badge'
import reportsService, { type DashboardSummary } from '@/services/reportsService'
import { formatCurrency, formatDate } from '@/utils/format'

function paymentBadge(status: string): 'green' | 'yellow' | 'red' {
  return status === 'PAID' ? 'green' : status === 'PARTIAL' ? 'yellow' : 'red'
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    reportsService.getSummary()
      .then(setSummary)
      .catch(() => {/* show placeholders */})
      .finally(() => setLoading(false))
  }, [])

  const s = summary

  const STATS = [
    {
      label: "Today's Sales",
      value: loading ? '…' : String(s?.today_sales ?? 0),
      icon: ShoppingCart,
      color: 'bg-blue-500',
      sub: loading ? '' : `${formatCurrency(s?.today_revenue ?? 0)} revenue`,
    },
    {
      label: 'Total Products',
      value: loading ? '…' : String(s?.total_products ?? 0),
      icon: Package,
      color: 'bg-green-500',
      sub: loading ? '' : `${s?.total_variants ?? 0} variants`,
    },
    {
      label: 'Active Warranties',
      value: loading ? '…' : String(s?.active_warranties ?? 0),
      icon: Shield,
      color: 'bg-purple-500',
      sub: loading ? '' : `${s?.pending_returns ?? 0} pending returns`,
    },
    {
      label: 'Total Revenue',
      value: loading ? '…' : formatCurrency(s?.total_revenue ?? 0),
      icon: TrendingUp,
      color: 'bg-orange-500',
      sub: loading ? '' : `${s?.total_sales ?? 0} sales all-time`,
    },
  ]

  return (
    <div className="space-y-6">

      {/* Welcome banner */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-6 text-white flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold">Welcome to SmartStock</h2>
          <p className="text-primary-100 mt-1 text-sm">
            Real-time inventory, sales terminal, barcode scanning, and warranty tracking.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/pos')}
            className="px-3.5 py-2 bg-white text-primary-700 font-medium rounded-lg text-sm hover:bg-primary-50 transition-colors shadow-sm flex items-center gap-1.5"
          >
            <ShoppingCart size={15} /> POS / New Sale
          </button>
          <button
            onClick={() => navigate('/scan')}
            className="px-3.5 py-2 bg-primary-800 text-white font-medium rounded-lg text-sm hover:bg-primary-900 transition-colors flex items-center gap-1.5 border border-primary-500/30"
          >
            <ScanLine size={15} /> Scan Product
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="card flex items-center gap-4">
            <div className={`${stat.color} p-3 rounded-xl text-white flex-shrink-0`}>
              <stat.icon size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold text-gray-900 truncate">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
              {stat.sub && <p className="text-xs text-gray-400 mt-0.5">{stat.sub}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Alerts row */}
      {!loading && s && (s.low_stock_count > 0 || s.pending_returns > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {s.low_stock_count > 0 && (
            <button
              onClick={() => navigate('/inventory/alerts')}
              className="card border-l-4 border-yellow-400 bg-yellow-50 flex items-center gap-3 text-left hover:bg-yellow-100 transition-colors"
            >
              <AlertTriangle size={20} className="text-yellow-500 flex-shrink-0" />
              <div>
                <p className="font-semibold text-yellow-900">Low Stock</p>
                <p className="text-sm text-yellow-700">{s.low_stock_count} variant{s.low_stock_count !== 1 ? 's' : ''} below reorder level</p>
              </div>
            </button>
          )}
          {s.pending_returns > 0 && (
            <button
              onClick={() => navigate('/returns')}
              className="card border-l-4 border-orange-400 bg-orange-50 flex items-center gap-3 text-left hover:bg-orange-100 transition-colors"
            >
              <RotateCcw size={20} className="text-orange-500 flex-shrink-0" />
              <div>
                <p className="font-semibold text-orange-900">Pending Refunds</p>
                <p className="text-sm text-orange-700">{s.pending_returns} return{s.pending_returns !== 1 ? 's' : ''} awaiting refund</p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Recent sales */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">Recent Sales</h3>
          <button onClick={() => navigate('/sales')} className="text-xs text-primary-600 hover:underline">
            View all →
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={22} className="animate-spin text-primary-400" />
          </div>
        ) : !s?.recent_sales.length ? (
          <p className="text-sm text-gray-400 text-center py-4">No sales yet — head to POS to make your first sale.</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-2 py-2 font-medium text-gray-500">Sale #</th>
                  <th className="text-left px-2 py-2 font-medium text-gray-500">Customer</th>
                  <th className="text-left px-2 py-2 font-medium text-gray-500">Date</th>
                  <th className="text-right px-2 py-2 font-medium text-gray-500">Amount</th>
                  <th className="text-left px-2 py-2 font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {s.recent_sales.map(sale => (
                  <tr
                    key={sale.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/sales/${sale.id}`)}
                  >
                    <td className="px-2 py-2.5 font-mono text-xs text-primary-600 font-medium">{sale.sale_number}</td>
                    <td className="px-2 py-2.5 text-gray-700">{sale.customer_name ?? <span className="text-gray-400">Walk-in</span>}</td>
                    <td className="px-2 py-2.5 text-gray-500 text-xs">{formatDate(sale.sale_date)}</td>
                    <td className="px-2 py-2.5 text-right font-semibold text-gray-900">{formatCurrency(sale.net_payable)}</td>
                    <td className="px-2 py-2.5">
                      <Badge variant={paymentBadge(sale.payment_status)}>{sale.payment_status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
