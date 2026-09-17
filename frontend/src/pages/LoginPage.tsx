/**
 * Login page — wired to real /api/v1/auth/login endpoint.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/services/authStore'

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})
type LoginFormData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const { login, isLoading } = useAuthStore()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data)
      toast.success('Welcome back!')
      navigate('/dashboard', { replace: true })
    } catch {
      // Error toast handled by Axios interceptor in api.ts
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-primary-700 font-bold text-2xl">SS</span>
          </div>
          <h1 className="text-3xl font-bold text-white">SmartStock</h1>
          <p className="text-primary-200 mt-1 text-sm">Inventory & POS Management System</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>

            <div>
              <label htmlFor="username" className="label">Username</label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                placeholder="Enter your username"
                className="input"
                {...register('username')}
              />
              {errors.username && (
                <p className="mt-1 text-xs text-red-600">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="input pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-2.5"
            >
              {isLoading
                ? <><Loader2 size={18} className="animate-spin" />Signing in...</>
                : 'Sign In'
              }
            </button>
          </form>

          {/* Default credentials hint (dev only) */}
          {import.meta.env.DEV && (
            <div className="mt-5 p-3 bg-amber-50 rounded-lg border border-amber-200">
              <p className="text-xs text-amber-800 font-semibold mb-1">Default credentials</p>
              <p className="text-xs text-amber-700 font-mono">Username: admin</p>
              <p className="text-xs text-amber-700 font-mono">Password: admin123</p>
              <p className="text-xs text-amber-600 mt-1">Change this after first login.</p>
            </div>
          )}
        </div>

        <p className="text-center text-primary-300 text-xs mt-6">
          SmartStock v0.1.0 — Local-first Inventory System
        </p>
      </div>
    </div>
  )
}
