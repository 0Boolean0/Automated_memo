/**
 * User & Role API service.
 * Centralizes all user/role HTTP calls so pages stay clean.
 */

import api from '@/services/api'
import type { User, Role } from '@/types'

export interface CreateUserPayload {
  username: string
  password: string
  full_name?: string
  email?: string
  phone?: string
  role_name: string
}

export interface UpdateUserPayload {
  full_name?: string
  email?: string
  phone?: string
  is_active?: boolean
  role_name?: string
}

// ─── Users ────────────────────────────────────────────────────────────────────

export const userService = {
  list: () => api.get<User[]>('/users/').then((r) => r.data),
  get: (id: number) => api.get<User>(`/users/${id}`).then((r) => r.data),
  create: (payload: CreateUserPayload) =>
    api.post<User>('/users/', payload).then((r) => r.data),
  update: (id: number, payload: UpdateUserPayload) =>
    api.put<User>(`/users/${id}`, payload).then((r) => r.data),
  deactivate: (id: number) => api.delete<User>(`/users/${id}`).then((r) => r.data),
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export const roleService = {
  list: () => api.get<Role[]>('/roles/').then((r) => r.data),
  updatePermissions: (id: number, permissions: string[]) =>
    api.put<Role>(`/roles/${id}`, { permissions }).then((r) => r.data),
}

// ─── Business ─────────────────────────────────────────────────────────────────

export interface BusinessInfo {
  id: number
  name: string
  slug: string
  phone?: string
  email?: string
  address?: string
  website?: string
  logo_url?: string
  currency: string
  tax_number?: string
  is_active: boolean
}

export interface UpdateBusinessPayload {
  name?: string
  phone?: string
  email?: string
  address?: string
  website?: string
  currency?: string
  tax_number?: string
}

export const businessService = {
  get: () => api.get<BusinessInfo>('/business/').then((r) => r.data),
  update: (payload: UpdateBusinessPayload) =>
    api.put<BusinessInfo>('/business/', payload).then((r) => r.data),
  uploadLogo: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api
      .post<BusinessInfo>('/business/logo', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },
}
