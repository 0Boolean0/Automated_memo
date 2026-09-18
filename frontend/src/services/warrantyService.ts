/**
 * Warranty service — Phase 10.
 */

import api from '@/services/api'

export type WarrantyStatus = 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'NO_WARRANTY'
export type ClaimStatus    = 'OPEN' | 'IN_REPAIR' | 'RESOLVED' | 'REJECTED'

export interface WarrantyUnit {
  serial_id:       number
  serial_number:   string
  product_name:    string | null
  variant_name:    string | null
  customer_name:   string | null
  sale_number:     string | null
  sold_at:         string | null
  warranty_months: number
  expiry_date:     string | null   // "YYYY-MM-DD"
  warranty_status: WarrantyStatus
  days_remaining:  number | null
  open_claims:     number
}

export interface WarrantyClaim {
  id:               number
  business_id:      number
  serial_id:        number
  serial_number:    string | null
  product_name:     string | null
  variant_name:     string | null
  customer_id:      number | null
  customer_name:    string | null
  claim_number:     string
  issue_desc:       string
  status:           ClaimStatus
  resolution_note:  string | null
  claimed_by_name:  string | null
  resolved_by_name: string | null
  resolved_at:      string | null
  created_at:       string
}

export interface PaginatedWarrantyUnits {
  items:    WarrantyUnit[]
  total:    number
  page:     number
  per_page: number
  pages:    number
}

export interface PaginatedClaims {
  items:    WarrantyClaim[]
  total:    number
  page:     number
  per_page: number
  pages:    number
}

export interface CreateClaimPayload {
  serial_id:   number
  issue_desc:  string
  customer_id?: number
}

export interface UpdateClaimPayload {
  status?:          ClaimStatus
  resolution_note?: string
}

const warrantyService = {
  /** List sold serialized units with warranty status. */
  listUnits: (params?: {
    status?: string
    search?: string
    page?: number
    per_page?: number
  }) =>
    api.get<PaginatedWarrantyUnits>('/warranty/', { params }).then(r => r.data),

  /** Warranty status for a single serial number. */
  getUnit: (serialId: number) =>
    api.get<WarrantyUnit>(`/warranty/${serialId}`).then(r => r.data),

  /** List warranty claims. */
  listClaims: (params?: { status?: string; page?: number; per_page?: number }) =>
    api.get<PaginatedClaims>('/warranty/claims', { params }).then(r => r.data),

  /** File a new warranty claim. */
  fileClaim: (payload: CreateClaimPayload) =>
    api.post<WarrantyClaim>('/warranty/claims', payload).then(r => r.data),

  /** Update claim status (IN_REPAIR / RESOLVED / REJECTED). */
  updateClaim: (id: number, payload: UpdateClaimPayload) =>
    api.put<WarrantyClaim>(`/warranty/claims/${id}`, payload).then(r => r.data),
}

export default warrantyService
