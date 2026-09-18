/**
 * Axios API client — the single entry point for all HTTP requests.
 *
 * Why centralize this?
 * - Authentication token is attached to every request in one place.
 * - 401 errors (token expired) are handled in one place.
 * - Base URL is configured once — change the backend URL here and it
 *   affects every request in the whole app.
 *
 * Usage:
 *   import api from '@/services/api'
 *   const products = await api.get('/products')
 */

import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import toast from 'react-hot-toast'

// ─────────────────────────────────────────────────────────────────────────────
// Base URL
// ─────────────────────────────────────────────────────────────────────────────
//
// In development: Vite's proxy forwards /api/* to localhost:8000.
// So we just use '/api/v1' — Vite handles the forwarding.
//
// In production: Both React and FastAPI are served from the same origin
// (FastAPI serves the built React files), so /api/v1 resolves correctly.
//
// If you need to point directly at the FastAPI server (e.g., mobile testing
// before HTTPS setup), you can temporarily set:
//   VITE_API_URL=http://192.168.0.100:8000/api/v1
// in a .env.local file in the frontend/ folder.

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

// ─────────────────────────────────────────────────────────────────────────────
// Axios instance
// ─────────────────────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // 30 second timeout — prevents requests hanging indefinitely
  timeout: 30000,
})

// ─────────────────────────────────────────────────────────────────────────────
// Request interceptor — attach auth token
// ─────────────────────────────────────────────────────────────────────────────
//
// Before every request, this runs and adds the Authorization header.
// The token is stored in localStorage (set by the auth store on login).

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// ─────────────────────────────────────────────────────────────────────────────
// Response interceptor — handle errors globally
// ─────────────────────────────────────────────────────────────────────────────
//
// After every response, this runs. It handles:
// - 401 Unauthorized: token expired → redirect to login
// - 403 Forbidden: show permission error
// - 422 Validation: show backend validation messages
// - 500 Server error: show generic error
//
// Individual components can still catch errors for custom handling;
// this just provides sensible defaults.

api.interceptors.response.use(
  // Success: just pass the response through unchanged
  (response) => response,

  // Error: handle common HTTP errors
  (error: AxiosError<{ detail: string | Array<{ msg: string }> }>) => {
    if (!error.response) {
      // Network error — server is probably not running
      toast.error('Cannot connect to server. Is it running?')
      return Promise.reject(error)
    }

    const { status, data } = error.response

    switch (status) {
      case 401:
        // Token expired or invalid — clear storage and redirect to login
        localStorage.removeItem('access_token')
        // Only redirect if not already on the login page
        if (!window.location.pathname.includes('/login')) {
          toast.error('Session expired. Please log in again.')
          window.location.href = '/login'
        }
        break

      case 403: {
        // Permission denied — show which permission is missing if available
        const detail = data?.detail
        const msg = typeof detail === 'string' ? detail : 'You do not have permission to perform this action.'
        toast.error(msg)
        break
      }

      case 404:
        // 404s are common and often handled by the calling component
        // Don't show a global toast for these
        break

      case 422: {
        // FastAPI validation error — detail is an array of {msg, type} objects
        const detail = data?.detail
        if (Array.isArray(detail)) {
          const messages = detail.map((e) => e.msg).join(', ')
          toast.error(`Validation error: ${messages}`)
        } else if (typeof detail === 'string') {
          toast.error(detail)
        } else {
          toast.error('Invalid data submitted.')
        }
        break
      }

      case 500:
        toast.error('Server error. Please check the backend logs.')
        break

      default:
        // For other errors, show the detail message if available
        if (data?.detail && typeof data.detail === 'string') {
          toast.error(data.detail)
        }
    }

    return Promise.reject(error)
  }
)

export default api
