/**
 * Returns service — Phase 11.
 */

import api from '@/services/api'

export type ReturnCondition  = 'GOOD' | 'DAMAGED'
export type RefundStatus     = 'PENDING' | 'ISSUED' | 'EXCHANGE' | 'NONE'
export type ReturnType       = 'CUSTOMER_RETURN' | 'SUPPLIER_RETURN'

export interface ReturnItemCreate {
  variant_id: number
  serial_id?: number
  quantity:   number
  condition:  ReturnCondition
  notes?:     string
}

export interface CreateReturnPayload {
  sale_id?:      number
  customer_id?:  number
  return_date:   string        // "YYYY-MM-DD"
  reason:        string
  return_type?:  ReturnType
  refund_amount: number
  refund_status: RefundStatus
  notes?:        string
  items:         ReturnItemCreate[]
}

export interface ReturnItemResponse {
  id:            number
  variant_id:    number
  variant_name:  string | null
  product_name:  string | null
  sku:           string | null
  serial_id:     number | null
  serial_number: string | null
  quantity:      number
  condition:     ReturnCondition
  notes:         string | null
}

export interface ReturnDetail {
  id:            number
  business_id:   number
  sale_id:       number | null
  sale_number:   string | null
  customer_id:   number | null
  customer_name: string | null
  return_number: string
  return_date:   string
  reason:        string
  return_type:   ReturnType
  refund_amount: number
  refund_status: RefundStatus
  notes:         string | null
  created_at:    string
  items:         ReturnItemResponse[]
}

export interface ReturnListItem {
  id:            number
  return_number: string
  sale_number:   string | null
  customer_name: string | null
  return_date:   string
  return_type:   ReturnType
  refund_amount: number
  refund_status: RefundStatus
  item_count:    number
  created_at:    string
}

export interface PaginatedReturns {
  items:    ReturnListItem[]
  total:    number
  page:     number
  per_page: number
  pages:    number
}

const returnsService = {
  list: (params?: {
    sale_id?: number
    customer_id?: number
    page?: number
    per_page?: number
  }) =>
    api.get<PaginatedReturns>('/returns/', { params }).then(r => r.data),

  get: (id: number) =>
    api.get<ReturnDetail>(`/returns/${id}`).then(r => r.data),

  create: (payload: CreateReturnPayload) =>
    api.post<ReturnDetail>('/returns/', payload).then(r => r.data),

  updateRefundStatus: (id: number, refund_status: RefundStatus) =>
    api.put<ReturnDetail>(`/returns/${id}/refund`, { refund_status }).then(r => r.data),
}

export default returnsService
