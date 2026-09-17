import api from '@/services/api'

export interface SupplierContact {
  id: number
  name: string
  phone: string | null
  email: string | null
  role: string | null
  is_primary: boolean
}

export interface Supplier {
  id: number
  business_id: number
  name: string
  company: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  contacts: SupplierContact[]
  purchase_count: number
}

export interface SupplierListItem {
  id: number
  name: string
  company: string | null
  phone: string | null
  is_active: boolean
  purchase_count: number
  created_at: string
}

export interface PaginatedSuppliers {
  items: SupplierListItem[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface CreateSupplierPayload {
  name: string
  company?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  contacts?: { name: string; phone?: string; email?: string; role?: string; is_primary?: boolean }[]
}

export const supplierService = {
  list: (params: { search?: string; page?: number; per_page?: number } = {}) =>
    api.get<PaginatedSuppliers>('/suppliers/', { params }).then(r => r.data),

  get: (id: number) =>
    api.get<Supplier>(`/suppliers/${id}`).then(r => r.data),

  create: (payload: CreateSupplierPayload) =>
    api.post<Supplier>('/suppliers/', payload).then(r => r.data),

  update: (id: number, payload: Partial<CreateSupplierPayload & { is_active: boolean }>) =>
    api.put<Supplier>(`/suppliers/${id}`, payload).then(r => r.data),
}
