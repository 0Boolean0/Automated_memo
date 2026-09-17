import api from '@/services/api'

export interface SerialInput {
  serial: string
  notes?: string
}

export interface PurchaseItemCreate {
  variant_id: number
  quantity: number
  unit_cost: number
  notes?: string
  serials: SerialInput[]
}

export interface CreatePurchasePayload {
  supplier_id?: number | null
  invoice_number?: string
  purchase_date: string          // ISO date "YYYY-MM-DD"
  paid_amount: number
  notes?: string
  items: PurchaseItemCreate[]
}

export interface PurchaseItemResponse {
  id: number
  variant_id: number
  variant_name: string | null
  product_name: string | null
  sku: string | null
  quantity: number
  unit_cost: number
  total_cost: number
  notes: string | null
  serial_count: number
}

export interface Purchase {
  id: number
  business_id: number
  supplier_id: number | null
  supplier_name: string | null
  purchase_number: string
  invoice_number: string | null
  purchase_date: string
  total_amount: number
  paid_amount: number
  due_amount: number
  payment_status: string
  notes: string | null
  created_at: string
  items: PurchaseItemResponse[]
}

export interface PurchaseListItem {
  id: number
  purchase_number: string
  supplier_name: string | null
  purchase_date: string
  total_amount: number
  paid_amount: number
  payment_status: string
  item_count: number
  created_at: string
}

export interface PaginatedPurchases {
  items: PurchaseListItem[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface PurchaseSerial {
  id: number
  serial: string
  status: string
  variant_id: number
  variant_name: string | null
  cost_price: number | null
  received_at: string | null
}

export const purchaseService = {
  list: (params: { supplier_id?: number; page?: number; per_page?: number } = {}) =>
    api.get<PaginatedPurchases>('/purchases/', { params }).then(r => r.data),

  get: (id: number) =>
    api.get<Purchase>(`/purchases/${id}`).then(r => r.data),

  create: (payload: CreatePurchasePayload) =>
    api.post<Purchase>('/purchases/', payload).then(r => r.data),

  getSerials: (id: number) =>
    api.get<{ serial_count: number; serials: PurchaseSerial[] }>(`/purchases/${id}/serials`).then(r => r.data),
}
