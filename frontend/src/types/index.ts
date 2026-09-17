// ─────────────────────────────────────────────────────────────────────────────
// Core shared types used across the whole application.
// These mirror the backend Pydantic schemas / SQLAlchemy models.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface User {
  id: number
  business_id: number
  username: string
  email: string | null
  full_name: string | null
  phone: string | null
  is_active: boolean
  roles: Role[]
  permissions: string[]
  last_login: string | null
  created_at: string
}

export interface Role {
  id: number
  name: RoleName
  permissions: string[]
}

export type RoleName = 'ADMIN' | 'MANAGER' | 'STAFF' | 'SELLER' | 'VIEWER'

export interface LoginCredentials {
  username: string
  password: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

// ─── Business ────────────────────────────────────────────────────────────────

export interface Business {
  id: number
  name: string
  slug: string
  phone: string | null
  email: string | null
  address: string | null
  website: string | null
  logo_url: string | null
  currency: string
  is_active: boolean
}

// ─── Serial Number Status ────────────────────────────────────────────────────

export type SerialStatus =
  | 'RECEIVED'
  | 'IN_STOCK'
  | 'RESERVED'
  | 'SOLD'
  | 'RETURNED'
  | 'DAMAGED'
  | 'WARRANTY'
  | 'TRANSFERRED'
  | 'CANCELLED'

// ─── Payment Status ───────────────────────────────────────────────────────────

export type PaymentStatus = 'PAID' | 'PARTIAL' | 'DUE' | 'REFUNDED'

export type PaymentMethod =
  | 'CASH'
  | 'BANK'
  | 'MOBILE_BANKING'
  | 'CARD'
  | 'CREDIT'
  | 'OTHER'

// ─── API Response Wrappers ───────────────────────────────────────────────────

// Standard paginated list response from the backend
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  pages: number
}

// Standard error response shape from FastAPI
export interface APIError {
  detail: string | { msg: string; type: string }[]
}

// ─── UI State ────────────────────────────────────────────────────────────────

export interface SelectOption {
  value: string | number
  label: string
}

export type LoadingState = 'idle' | 'loading' | 'success' | 'error'
