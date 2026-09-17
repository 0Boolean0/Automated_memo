/**
 * Settings page.
 * Tabs:
 * - Business Info (Admin only — edit name, phone, address, logo)
 * - Account (all users — change password, update own profile)
 */

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, User, Loader2, Upload, Check } from 'lucide-react'
import toast from 'react-hot-toast'

import { businessService, type BusinessInfo, type UpdateBusinessPayload } from '@/services/userService'
import { useAuthStore } from '@/services/authStore'
import api from '@/services/api'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const businessSchema = z.object({
  name:       z.string().min(1, 'Business name is required'),
  phone:      z.string().optional(),
  email:      z.string().email('Invalid email').optional().or(z.literal('')),
  address:    z.string().optional(),
  website:    z.string().optional(),
  currency:   z.string().min(1, 'Currency is required'),
  tax_number: z.string().optional(),
})

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password:     z.string().min(6, 'At least 6 characters'),
  confirm_password: z.string(),
}).refine((d) => d.new_password === d.confirm_password, {
  message: "Passwords don't match",
  path: ['confirm_password'],
})

const profileSchema = z.object({
  full_name: z.string().optional(),
  email:     z.string().email('Invalid email').optional().or(z.literal('')),
  phone:     z.string().optional(),
})

type BusinessForm  = z.infer<typeof businessSchema>
type PasswordForm  = z.infer<typeof passwordSchema>
type ProfileForm   = z.infer<typeof profileSchema>
type Tab = 'business' | 'account'

// ─── Component ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user: currentUser, hasRole, refreshMe } = useAuthStore()
  const isAdmin = hasRole('ADMIN')
  const [activeTab, setActiveTab] = useState<Tab>(isAdmin ? 'business' : 'account')
  const [business, setBusiness] = useState<BusinessInfo | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [savingBusiness, setSavingBusiness] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)

  // ── Business form ─────────────────────────────────────────────────────────
  const bizForm = useForm<BusinessForm>({ resolver: zodResolver(businessSchema) })

  useEffect(() => {
    businessService.get().then((b) => {
      setBusiness(b)
      bizForm.reset({
        name:       b.name,
        phone:      b.phone       ?? '',
        email:      b.email       ?? '',
        address:    b.address     ?? '',
        website:    b.website     ?? '',
        currency:   b.currency,
        tax_number: b.tax_number  ?? '',
      })
    }).catch(() => toast.error('Failed to load business info'))
  }, [])

  const onSaveBusiness = async (data: BusinessForm) => {
    setSavingBusiness(true)
    try {
      // Upload logo first if selected
      if (logoFile) {
        await businessService.uploadLogo(logoFile)
        setLogoFile(null)
        setLogoPreview(null)
      }
      const payload: UpdateBusinessPayload = {
        ...data,
        email: data.email || undefined,
      }
      const updated = await businessService.update(payload)
      setBusiness(updated)
      toast.success('Business info saved')
    } catch { /* interceptor shows toast */ }
    finally { setSavingBusiness(false) }
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  // ── Password form ─────────────────────────────────────────────────────────
  const pwForm = useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) })

  const onChangePassword = async (data: PasswordForm) => {
    setSavingPassword(true)
    try {
      await api.post('/auth/change-password', {
        current_password: data.current_password,
        new_password:     data.new_password,
      })
      toast.success('Password changed successfully')
      pwForm.reset()
    } catch { /* interceptor shows toast */ }
    finally { setSavingPassword(false) }
  }

  // ── Profile form ──────────────────────────────────────────────────────────
  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: currentUser?.full_name ?? '',
      email:     currentUser?.email     ?? '',
      phone:     currentUser?.phone     ?? '',
    },
  })

  const onSaveProfile = async (data: ProfileForm) => {
    setSavingProfile(true)
    try {
      await api.put('/auth/me', data)
      await refreshMe()
      toast.success('Profile updated')
    } catch { /* interceptor shows toast */ }
    finally { setSavingProfile(false) }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    ...(isAdmin ? [{ id: 'business' as Tab, label: 'Business Info', icon: Building2 }] : []),
    { id: 'account', label: 'My Account', icon: User },
  ]

  return (
    <div className="max-w-3xl space-y-5">

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
              ${activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'}`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Business Info tab ─────────────────────────────────────────────── */}
      {activeTab === 'business' && isAdmin && (
        <form onSubmit={bizForm.handleSubmit(onSaveBusiness)} className="space-y-5">
          <div className="card space-y-5">
            <h3 className="font-semibold text-gray-900">Business Information</h3>

            {/* Logo upload */}
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                {logoPreview || business?.logo_url ? (
                  <img
                    src={logoPreview ?? business?.logo_url!}
                    alt="Logo"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building2 size={28} className="text-gray-400" />
                )}
              </div>
              <div>
                <label
                  htmlFor="logo-upload"
                  className="btn-secondary cursor-pointer flex items-center gap-2 text-sm"
                >
                  <Upload size={15} />
                  {logoFile ? logoFile.name : 'Upload Logo'}
                </label>
                <input
                  id="logo-upload"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.svg"
                  className="hidden"
                  onChange={handleLogoChange}
                />
                <p className="text-xs text-gray-400 mt-1">JPG, PNG, WebP or SVG</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Business Name *</label>
                <input className="input" {...bizForm.register('name')} />
                {bizForm.formState.errors.name && (
                  <p className="mt-1 text-xs text-red-600">{bizForm.formState.errors.name.message}</p>
                )}
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" {...bizForm.register('phone')} />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" {...bizForm.register('email')} />
              </div>
              <div className="col-span-2">
                <label className="label">Address</label>
                <textarea className="input" rows={2} {...bizForm.register('address')} />
              </div>
              <div>
                <label className="label">Website</label>
                <input className="input" placeholder="https://..." {...bizForm.register('website')} />
              </div>
              <div>
                <label className="label">Currency</label>
                <select className="input" {...bizForm.register('currency')}>
                  <option value="BDT">BDT — Bangladeshi Taka</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                </select>
              </div>
              <div>
                <label className="label">Tax / VAT Number</label>
                <input className="input" placeholder="Optional" {...bizForm.register('tax_number')} />
              </div>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={savingBusiness} className="btn-primary flex items-center gap-2">
              {savingBusiness ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Save Business Info
            </button>
          </div>
        </form>
      )}

      {/* ── Account tab ───────────────────────────────────────────────────── */}
      {activeTab === 'account' && (
        <div className="space-y-5">

          {/* Profile */}
          <form onSubmit={profileForm.handleSubmit(onSaveProfile)}>
            <div className="card space-y-4">
              <h3 className="font-semibold text-gray-900">My Profile</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Username</label>
                  <input className="input bg-gray-50" value={currentUser?.username ?? ''} disabled />
                  <p className="text-xs text-gray-400 mt-1">Username cannot be changed.</p>
                </div>
                <div className="col-span-2">
                  <label className="label">Full Name</label>
                  <input className="input" {...profileForm.register('full_name')} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" {...profileForm.register('email')} />
                  {profileForm.formState.errors.email && (
                    <p className="mt-1 text-xs text-red-600">{profileForm.formState.errors.email.message}</p>
                  )}
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" {...profileForm.register('phone')} />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button type="submit" disabled={savingProfile} className="btn-primary flex items-center gap-2">
                  {savingProfile ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Save Profile
                </button>
              </div>
            </div>
          </form>

          {/* Change password */}
          <form onSubmit={pwForm.handleSubmit(onChangePassword)}>
            <div className="card space-y-4">
              <h3 className="font-semibold text-gray-900">Change Password</h3>
              <div>
                <label className="label">Current Password</label>
                <input type="password" className="input" {...pwForm.register('current_password')} />
                {pwForm.formState.errors.current_password && (
                  <p className="mt-1 text-xs text-red-600">{pwForm.formState.errors.current_password.message}</p>
                )}
              </div>
              <div>
                <label className="label">New Password</label>
                <input type="password" className="input" {...pwForm.register('new_password')} />
                {pwForm.formState.errors.new_password && (
                  <p className="mt-1 text-xs text-red-600">{pwForm.formState.errors.new_password.message}</p>
                )}
              </div>
              <div>
                <label className="label">Confirm New Password</label>
                <input type="password" className="input" {...pwForm.register('confirm_password')} />
                {pwForm.formState.errors.confirm_password && (
                  <p className="mt-1 text-xs text-red-600">{pwForm.formState.errors.confirm_password.message}</p>
                )}
              </div>
              <div className="flex justify-end pt-1">
                <button type="submit" disabled={savingPassword} className="btn-primary flex items-center gap-2">
                  {savingPassword ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Change Password
                </button>
              </div>
            </div>
          </form>

          {/* Role info */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 mb-3">Permissions</h3>
            <p className="text-sm text-gray-500 mb-3">
              Your role: <strong>{currentUser?.roles?.[0]?.name ?? 'None'}</strong>
            </p>
            <div className="flex flex-wrap gap-1.5">
              {currentUser?.permissions?.map((p) => (
                <span key={p} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded-full font-mono">
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
