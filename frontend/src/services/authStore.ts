/**
 * Authentication state store using Zustand.
 *
 * Zustand is a lightweight state management library.
 * Think of it like a global variable that React components can
 * subscribe to and re-render when it changes.
 *
 * Why Zustand instead of React Context?
 * - No Provider wrapper needed in the component tree.
 * - Components only re-render when the specific value they use changes.
 * - Simpler API than Redux.
 *
 * Usage in any component:
 *   const { user, login, logout, hasPermission } = useAuthStore()
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/services/api'
import type { User, LoginCredentials, AuthResponse } from '@/types'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean

  // Actions
  login: (credentials: LoginCredentials) => Promise<void>
  logout: () => void
  hasPermission: (permission: string) => boolean
  hasRole: (role: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  // persist middleware saves the state to localStorage automatically.
  // When the user refreshes the page, the state is restored.
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true })
        try {
          const response = await api.post<AuthResponse>('/auth/login', credentials)
          const { access_token, user } = response.data

          // Store token in localStorage so the Axios interceptor can attach it
          localStorage.setItem('access_token', access_token)

          set({
            user,
            token: access_token,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (error) {
          set({ isLoading: false })
          throw error // Let the login form handle the error message
        }
      },

      logout: () => {
        localStorage.removeItem('access_token')
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        })
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
      name: 'smartstock-auth', // localStorage key
      // Only persist the user and token, not loading state
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
