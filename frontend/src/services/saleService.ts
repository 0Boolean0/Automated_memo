/**
 * Sale service — Phase 8.
 */

import api from '@/services/api'

export interface SerialSaleInput {
  serial: string
}

export interface SaleItemCreate {
  variant_id: number
  quantity: number
  unit_price?: number       // undefined = use variant.selling_price
  discount_amount?: number
  serials: SerialSaleInput[]
  notes?: string
}

export interface CreateSalePayload {
  customer_id?: number | null
  sale_date: string          // "YYYY-MM-DD"
  paid_amount: number
  discount_amount?: number
  loyalty_points_redeemed?: number
  notes?: string
  items: SaleItemCreate[]
}

export interface SaleItemResponse {
  id: number
  variant_id: number
  variant_name: string | null
  product_name: string | null
  sku: string | null
  quantity: number
  unit_price: number
  discount_amount: number
  total_price: number
  notes: string | null
  serial_count: number
}

export interface Sale {
  id: number
  business_id: number
  customer_id: number | null
  customer_name: string | null
  customer_phone: string | null
  sale_number: string
  sale_date: string
  total_amount: number
  discount_amount: number
  loyalty_points_redeemed: number
  loyalty_points_earned: number
  paid_amount: number
  net_payable: number
  due_amount: number
  payment_status: string
  notes: string | null
  created_at: string
  items: SaleItemResponse[]
}

export interface SaleListItem {
  id: number
  sale_number: string
  customer_name: string | null
  sale_date: string
  total_amount: number
  paid_amount: number
  net_payable: number
  due_amount: number
  payment_status: string
  item_count: number
  created_at: string
}

export interface PaginatedSales {
  items: SaleListItem[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface SaleSerial {
  id: number
  serial: string
  status: string
  variant_id: number
  variant_name: string | null
  sold_at: string | null
}

export const saleService = {
  list: (params: { customer_id?: number; payment_status?: string; page?: number; per_page?: number } = {}) =>
    api.get<PaginatedSales>('/sales/', { params }).then(r => r.data),

  get: (id: number) =>
    api.get<Sale>(`/sales/${id}`).then(r => r.data),

  create: (payload: CreateSalePayload) =>
    api.post<Sale>('/sales/', payload).then(r => r.data),

  getSerials: (id: number) =>
    api.get<{ sale_id: number; serial_count: number; serials: SaleSerial[] }>(`/sales/${id}/serials`).then(r => r.data),
}
