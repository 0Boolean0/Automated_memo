/**
 * Reports page — Phase 12.
 *
 * Three tabs:
 *   Sales    — revenue line chart (7/14/30/90d), summary cards, recent sales table
 *   Products — top products bar chart (qty sold + revenue)
 *   Inventory— stock value by category bar chart, recent adjustments
 */

import { useEffect, useState, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { Loader2, TrendingUp, Package, Boxes } from 'lucide-react'
import reportsService, {
  type DashboardSummary, type SalesChartPoint,
  type TopProduct, type InventoryReport,
} from '@/services/reportsService'
import { formatCurrency } from '@/utils/format'

// ─── Shared ───────────────────────────────────────────────────────────────────

function SectionLoader() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 size={28} className="animate-spin text-primary-500" />
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card text-center">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      {sub && <p className="text-xs text-primary-600 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Sales Tab ────────────────────────────────────────────────────────────────

function SalesTab() {
  const [days, setDays]       = useState(30)
  const [chart, setChart]     = useState<SalesChartPoint[]>([])
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [chartRes, sumRes] = await Promise.all([
        reportsService.getSalesChart(days),
        reportsService.getSummary(),
      ])
      setChart(chartRes.data)
      setSummary(sumRes)
    } catch { /* interceptor */ }
    finally { setLoading(false) }
  }, [days])

  useEffect(() => { fetchData() }, [fetchData])

  const totalRevenue = chart.reduce((s, d) => s + d.revenue, 0)
  const totalCount   = chart.reduce((s, d) => s + d.sales_count, 0)
  const avgDaily     = chart.length ? totalRevenue / chart.length : 0

  // Shorten date labels: "Sep 18"
  const formatXDate = (d: string) => {
    const dt = new Date(d)
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 mr-1">Period:</span>
        {[7, 14, 30, 90].map(d => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              days === d ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {loading ? <SectionLoader /> : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label={`Revenue (${days}d)`}   value={formatCurrency(totalRevenue)} />
            <StatCard label={`Sales (${days}d)`}     value={String(totalCount)} />
            <StatCard label="Daily Avg"              value={formatCurrency(avgDaily)} />
            <StatCard label="All-time Revenue"       value={formatCurrency(summary?.total_revenue ?? 0)} />
          </div>

          {/* Revenue line chart */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Daily Revenue — Last {days} Days</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chart} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatXDate}
                  tick={{ fontSize: 11 }}
                  interval={Math.floor(chart.length / 7)}
                />
                <YAxis tickFormatter={v => `৳${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} width={50} />
                <Tooltip
                  formatter={(v: number) => [formatCurrency(v), 'Revenue']}
                  labelFormatter={formatXDate}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Sales count bar chart */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Daily Sales Count — Last {days} Days</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chart} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatXDate}
                  tick={{ fontSize: 11 }}
                  interval={Math.floor(chart.length / 7)}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} />
                <Tooltip labelFormatter={formatXDate} />
                <Bar dataKey="sales_count" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Sales" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Products Tab ─────────────────────────────────────────────────────────────

function ProductsTab() {
  const [days, setDays]         = useState<number | undefined>(undefined)
  const [products, setProducts] = useState<TopProduct[]>([])
  const [loading, setLoading]   = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await reportsService.getTopProducts(10, days)
      setProducts(res.data)
    } catch { /* interceptor */ }
    finally { setLoading(false) }
  }, [days])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 mr-1">Period:</span>
        {([undefined, 7, 30, 90] as (number | undefined)[]).map(d => (
          <button
            key={String(d)}
            onClick={() => setDays(d)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              days === d ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {d ? `${d}d` : 'All'}
          </button>
        ))}
      </div>

      {loading ? <SectionLoader /> : products.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">No sales data yet.</div>
      ) : (
        <>
          {/* Bar chart: qty sold */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-4">Top 10 by Units Sold</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={products}
                layout="vertical"
                margin={{ top: 4, right: 60, left: 4, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  dataKey="variant_name"
                  type="category"
                  width={130}
                  tick={{ fontSize: 11 }}
                  tickFormatter={v => v.length > 18 ? v.slice(0, 17) + '…' : v}
                />
                <Tooltip formatter={(v: number) => [v, 'Units sold']} />
                <Bar dataKey="qty_sold" fill="#2563eb" radius={[0, 4, 4, 0]} name="Units Sold" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="font-semibold text-sm text-gray-700">Top Products Detail</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium text-gray-500">#</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-500">Product</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500">Units Sold</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-500">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {products.map((p, i) => (
                    <tr key={p.variant_id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-gray-400 font-mono">{i + 1}</td>
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{p.product_name}</p>
                        <p className="text-xs text-gray-500">{p.variant_name}{p.sku ? ` · ${p.sku}` : ''}</p>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-gray-900">{p.qty_sold}</td>
                      <td className="px-5 py-3 text-right text-gray-700">{formatCurrency(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Inventory Tab ────────────────────────────────────────────────────────────

function InventoryTab() {
  const [report, setReport] = useState<InventoryReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    reportsService.getInventory()
      .then(setReport)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <SectionLoader />
  if (!report)  return <div className="card text-center py-12 text-gray-400">No inventory data.</div>

  return (
    <div className="space-y-5">
      {/* Value summary */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Total Stock Value (Cost)"
          value={formatCurrency(report.total_stock_value)}
          sub="Based on cost prices"
        />
        <StatCard
          label="Total Retail Value"
          value={formatCurrency(report.total_retail_value)}
          sub="Based on selling prices"
        />
      </div>

      {/* Stock by category bar chart */}
      {report.by_category.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4">Stock by Category</h3>
          <ResponsiveContainer width="100%" height={Math.max(180, report.by_category.length * 38)}>
            <BarChart
              data={report.by_category}
              layout="vertical"
              margin={{ top: 4, right: 80, left: 4, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                dataKey="name"
                type="category"
                width={120}
                tick={{ fontSize: 11 }}
                tickFormatter={v => v.length > 16 ? v.slice(0, 15) + '…' : v}
              />
              <Tooltip
                formatter={(v: number, name: string) => [
                  name === 'stock' ? v : formatCurrency(v),
                  name === 'stock' ? 'Units' : 'Retail Value',
                ]}
              />
              <Bar dataKey="stock"        fill="#2563eb" radius={[0, 3, 3, 0]} name="stock" />
              <Bar dataKey="retail_value" fill="#10b981" radius={[0, 3, 3, 0]} name="retail_value" />
              <Legend />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent adjustments */}
      {report.recent_adjustments.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <p className="font-semibold text-sm text-gray-700">Recent Adjustments</p>
          </div>
          <div className="divide-y divide-gray-50">
            {report.recent_adjustments.map(a => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">{a.reason}</p>
                  <p className="text-xs text-gray-500">{a.adjustment_type}</p>
                </div>
                <span className={`text-sm font-semibold ${a.quantity_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {a.quantity_change >= 0 ? '+' : ''}{a.quantity_change}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [tab, setTab] = useState<'sales' | 'products' | 'inventory'>('sales')

  const tabs = [
    { key: 'sales',     label: 'Sales',     icon: TrendingUp },
    { key: 'products',  label: 'Products',  icon: Package },
    { key: 'inventory', label: 'Inventory', icon: Boxes },
  ] as const

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Reports</h2>
        <p className="text-sm text-gray-500 mt-0.5">Sales trends, top products, and inventory analysis</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sales'     && <SalesTab />}
      {tab === 'products'  && <ProductsTab />}
      {tab === 'inventory' && <InventoryTab />}
    </div>
  )
}
