/**
 * Authentication state store using Zustand.
 *
 * Calls the real /api/v1/auth/login endpoint.
 * Stores the JWT token in localStorage so the Axios interceptor
 * in api.ts attaches it to every subsequent request.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/services/api'
import type { User, LoginCredentials } from '@/types'

interface LoginResponse {
  access_token: string
  token_type: string
  user: User
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean

  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => Promise<void>
  refreshMe: () => Promise<void>
  hasPermission: (permission: string) => boolean
  hasRole: (role: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true })
        try {
          const { data } = await api.post<LoginResponse>('/auth/login', credentials)
          localStorage.setItem('access_token', data.access_token)
          set({
            user: data.user,
            token: data.access_token,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout')
        } catch {
          // Ignore — logout is best-effort
        }
        localStorage.removeItem('access_token')
        set({ user: null, token: null, isAuthenticated: false })
      },

      /** Re-fetch the current user profile from /auth/me (e.g. after profile update) */
      refreshMe: async () => {
        try {
          const { data } = await api.get<User>('/auth/me')
          set({ user: data })
        } catch {
          // Token may be expired — clear state
          localStorage.removeItem('access_token')
          set({ user: null, token: null, isAuthenticated: false })
        }
      },

      hasPermission: (permission: string): boolean => {
        const { user } = get()
        if (!user) return false
        return user.permissions?.includes(permission) ?? false
      },

      hasRole: (role: string): boolean => {
        const { user } = get()
        if (!user) return false
        return user.roles?.some((r) => r.name === role) ?? false
      },
    }),
    {
      name: 'smartstock-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
