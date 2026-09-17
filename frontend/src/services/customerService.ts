/**
 * Customer service — Phase 7.
 */

import api from '@/services/api'

export type CustomerType = 'RETAIL' | 'WHOLESALE'

export interface Customer {
  id: number
  business_id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  customer_type: CustomerType
  loyalty_points: number
  notes: string | null
  is_active: boolean
  created_at: string
  sale_count: number
}

export interface CustomerListItem {
  id: number
  name: string
  phone: string | null
  email: string | null
  customer_type: CustomerType
  loyalty_points: number
  is_active: boolean
  sale_count: number
  created_at: string
}

export interface PaginatedCustomers {
  items: CustomerListItem[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface CreateCustomerPayload {
  name: string
  phone?: string
  email?: string
  address?: string
  customer_type?: CustomerType
  notes?: string
}

export interface UpdateCustomerPayload {
  name?: string
  phone?: string
  email?: string
  address?: string
  customer_type?: CustomerType
  notes?: string
  is_active?: boolean
  loyalty_points?: number
}

export const customerService = {
  list: (params: { search?: string; customer_type?: string; page?: number; per_page?: number } = {}) =>
    api.get<PaginatedCustomers>('/customers/', { params }).then(r => r.data),

  get: (id: number) =>
    api.get<Customer>(`/customers/${id}`).then(r => r.data),

  create: (payload: CreateCustomerPayload) =>
    api.post<Customer>('/customers/', payload).then(r => r.data),

  update: (id: number, payload: UpdateCustomerPayload) =>
    api.put<Customer>(`/customers/${id}`, payload).then(r => r.data),
}
