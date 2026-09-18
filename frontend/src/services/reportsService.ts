/**
 * Reports service — Phase 12.
 */

import api from '@/services/api'

export interface DashboardSummary {
  today_sales:       number
  today_revenue:     number
  total_sales:       number
  total_revenue:     number
  total_products:    number
  total_variants:    number
  low_stock_count:   number
  active_warranties: number
  pending_returns:   number
  recent_sales: {
    id:             number
    sale_number:    string
    sale_date:      string
    customer_name:  string | null
    total_amount:   number
    net_payable:    number
    payment_status: string
  }[]
}

export interface SalesChartPoint {
  date:        string   // "YYYY-MM-DD"
  revenue:     number
  sales_count: number
}

export interface TopProduct {
  variant_id:   number
  variant_name: string
  product_name: string
  sku:          string | null
  qty_sold:     number
  revenue:      number
}

export interface InventoryReport {
  total_stock_value:  number
  total_retail_value: number
  by_category: {
    name:         string
    stock:        number
    cost_value:   number
    retail_value: number
  }[]
  recent_adjustments: {
    id:              number
    adjustment_type: string
    quantity_change: number
    reason:          string
    created_at:      string | null
  }[]
}

const reportsService = {
  getSummary: () =>
    api.get<DashboardSummary>('/reports/summary').then(r => r.data),

  getSalesChart: (days = 30) =>
    api.get<{ days: number; data: SalesChartPoint[] }>('/reports/sales-chart', { params: { days } }).then(r => r.data),

  getTopProducts: (limit = 10, days?: number) =>
    api.get<{ limit: number; days: number | null; data: TopProduct[] }>(
      '/reports/top-products', { params: { limit, ...(days ? { days } : {}) } }
    ).then(r => r.data),

  getInventory: () =>
    api.get<InventoryReport>('/reports/inventory').then(r => r.data),
}

export default reportsService
