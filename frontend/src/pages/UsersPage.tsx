/**
 * User Management page.
 * Lists all users, allows creating, editing, and deactivating.
 * Only visible to ADMIN role.
 */

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { UserPlus, Pencil, UserX, Loader2, ShieldCheck, KeyRound, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Badge, { roleBadgeVariant } from '@/components/ui/Badge'
import { userService, roleService, type CreateUserPayload, type UpdateUserPayload } from '@/services/userService'
import { useAuthStore } from '@/services/authStore'
import type { User, Role } from '@/types'

// ─── Form schemas ─────────────────────────────────────────────────────────────

const createSchema = z.object({
  username:  z.string().min(3, 'At least 3 characters'),
  password:  z.string().min(6, 'At least 6 characters'),
  full_name: z.string().optional(),
  email:     z.string().email('Invalid email').optional().or(z.literal('')),
  phone:     z.string().optional(),
  role_name: z.string().min(1, 'Select a role'),
})

const editSchema = z.object({
  full_name: z.string().optional(),
  email:     z.string().email('Invalid email').optional().or(z.literal('')),
  phone:     z.string().optional(),
  role_name: z.string().min(1, 'Select a role'),
  is_active: z.boolean(),
})

type CreateForm = z.infer<typeof createSchema>
type EditForm   = z.infer<typeof editSchema>

const ROLE_NAMES = ['ADMIN', 'MANAGER', 'STAFF', 'SELLER', 'VIEWER']

// ─── Component ────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const { user: currentUser, hasRole } = useAuthStore()
  const isAdmin = hasRole('ADMIN')

  const [users, setUsers]         = useState<User[]>([])
  const [roles, setRoles]         = useState<Role[]>([])
  const [loading, setLoading]     = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser]   = useState<User | null>(null)
  const [deactivateUser, setDeactivateUser] = useState<User | null>(null)

  // Password reset modal state
  const [passwordUser, setPasswordUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  // ── Fetch users + roles ────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true)
    try {
      const [usersData, rolesData] = await Promise.all([
        userService.list(),
        roleService.list(),
      ])
      setUsers(usersData)
      setRoles(rolesData)
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // ── Create form ────────────────────────────────────────────────────────────
  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { role_name: 'STAFF' },
  })

  const onCreateSubmit = async (data: CreateForm) => {
    try {
      const payload: CreateUserPayload = {
        ...data,
        email: data.email || undefined,
      }
      await userService.create(payload)
      toast.success(`User '${data.username}' created`)
      setShowCreate(false)
      createForm.reset()
      fetchData()
    } catch { /* interceptor shows toast */ }
  }

  // ── Edit form ──────────────────────────────────────────────────────────────
  const editForm = useForm<EditForm>({ resolver: zodResolver(editSchema) })

  const openEdit = (u: User) => {
    setEditUser(u)
    editForm.reset({
      full_name: u.full_name ?? '',
      email:     u.email    ?? '',
      phone:     u.phone    ?? '',
      role_name: u.roles[0]?.name ?? 'STAFF',
      is_active: u.is_active,
    })
  }

  const onEditSubmit = async (data: EditForm) => {
    if (!editUser) return
    try {
      const payload: UpdateUserPayload = {
        ...data,
        email: data.email || undefined,
      }
      await userService.update(editUser.id, payload)
      toast.success('User updated')
      setEditUser(null)
      fetchData()
    } catch { /* interceptor shows toast */ }
  }

  // ── Deactivate ─────────────────────────────────────────────────────────────
  const handleDeactivate = async () => {
    if (!deactivateUser) return
    try {
      await userService.deactivate(deactivateUser.id)
      toast.success(`User '${deactivateUser.username}' deactivated`)
      fetchData()
    } catch { /* interceptor shows toast */ }
  }

  // ── Change Password ────────────────────────────────────────────────────────
  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordUser) return
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setSavingPassword(true)
    try {
      await userService.changePassword(passwordUser.id, newPassword)
      toast.success(`Password changed for @${passwordUser.username}`)
      setPasswordUser(null)
      setNewPassword('')
      setConfirmPassword('')
    } catch {
      /* interceptor shows toast */
    } finally {
      setSavingPassword(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <ShieldCheck size={48} className="text-gray-300 mb-4" />
        <h2 className="text-xl font-semibold text-gray-700">Admin Access Required</h2>
        <p className="text-gray-500 text-sm mt-2">Only admins can manage users.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">User Management</h2>
          <p className="text-sm text-gray-500 mt-0.5">{users.length} users in this business</p>
        </div>
        <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
          <UserPlus size={16} />
          New User
        </button>
      </div>

      {/* Users table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={28} className="animate-spin text-primary-500" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-center text-gray-500 py-12 text-sm">No users found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-medium text-gray-600">User</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Last Login</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 font-semibold text-sm flex items-center justify-center">
                          {(u.full_name || u.username).charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {u.full_name || u.username}
                            {u.id === currentUser?.id && (
                              <span className="ml-2 text-xs text-primary-600 font-normal">(you)</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-500">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {u.roles[0] ? (
                        <Badge variant={roleBadgeVariant(u.roles[0].name)}>
                          {u.roles[0].name}
                        </Badge>
                      ) : (
                        <Badge variant="gray">No role</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={u.is_active ? 'green' : 'gray'}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {u.last_login
                        ? new Date(u.last_login).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => openEdit(u)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                          title="Edit user"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => {
                            setPasswordUser(u)
                            setNewPassword('')
                            setConfirmPassword('')
                          }}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title="Change / Reset password"
                        >
                          <KeyRound size={15} />
                        </button>
                        {u.id !== currentUser?.id && u.is_active && (
                          <button
                            onClick={() => setDeactivateUser(u)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Deactivate user"
                          >
                            <UserX size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create User Modal ─────────────────────────────────────────────── */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New User">
        <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Username *</label>
              <input className="input" placeholder="e.g. john_seller" {...createForm.register('username')} />
              {createForm.formState.errors.username && (
                <p className="mt-1 text-xs text-red-600">{createForm.formState.errors.username.message}</p>
              )}
            </div>
            <div className="col-span-2">
              <label className="label">Password *</label>
              <input type="password" className="input" placeholder="Min. 6 characters" {...createForm.register('password')} />
              {createForm.formState.errors.password && (
                <p className="mt-1 text-xs text-red-600">{createForm.formState.errors.password.message}</p>
              )}
            </div>
            <div className="col-span-2">
              <label className="label">Full Name</label>
              <input className="input" placeholder="Optional" {...createForm.register('full_name')} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" placeholder="Optional" {...createForm.register('email')} />
              {createForm.formState.errors.email && (
                <p className="mt-1 text-xs text-red-600">{createForm.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" placeholder="Optional" {...createForm.register('phone')} />
            </div>
            <div className="col-span-2">
              <label className="label">Role *</label>
              <select className="input" {...createForm.register('role_name')}>
                {ROLE_NAMES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2 justify-end">
            <button type="button" className="btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={createForm.formState.isSubmitting}>
              {createForm.formState.isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Edit User Modal ───────────────────────────────────────────────── */}
      <Modal isOpen={!!editUser} onClose={() => setEditUser(null)} title="Edit User">
        {editUser && (
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Full Name</label>
                <input className="input" {...editForm.register('full_name')} />
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className="input" {...editForm.register('email')} />
                {editForm.formState.errors.email && (
                  <p className="mt-1 text-xs text-red-600">{editForm.formState.errors.email.message}</p>
                )}
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" {...editForm.register('phone')} />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="input" {...editForm.register('role_name')}>
                  {ROLE_NAMES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3 pt-5">
                <input type="checkbox" id="is_active" className="w-4 h-4" {...editForm.register('is_active')} />
                <label htmlFor="is_active" className="text-sm text-gray-700">Active account</label>
              </div>
            </div>
            <div className="flex gap-3 pt-2 justify-between items-center border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  const u = editUser
                  setEditUser(null)
                  setPasswordUser(u)
                  setNewPassword('')
                  setConfirmPassword('')
                }}
                className="text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 transition-colors"
              >
                <KeyRound size={13} />
                Change Password
              </button>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary" onClick={() => setEditUser(null)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={editForm.formState.isSubmitting}>
                  {editForm.formState.isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Change User Password Modal ─────────────────────────────────────── */}
      <Modal
        isOpen={!!passwordUser}
        onClose={() => {
          setPasswordUser(null)
          setNewPassword('')
          setConfirmPassword('')
        }}
        title={`Change Password — @${passwordUser?.username}`}
        maxWidth="sm"
      >
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <p className="text-xs text-gray-500">
            Set a new password for <span className="font-semibold text-gray-800">{passwordUser?.full_name || passwordUser?.username}</span> (@{passwordUser?.username}).
          </p>

          <div>
            <label className="label">New Password *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input pr-10"
                placeholder="Min. 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label className="label">Confirm New Password *</label>
            <input
              type={showPassword ? 'text' : 'password'}
              className="input"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-3 border-t border-gray-100">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setPasswordUser(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingPassword || newPassword.length < 6 || newPassword !== confirmPassword}
              className="btn-primary flex items-center gap-1.5"
            >
              {savingPassword && <Loader2 size={14} className="animate-spin" />}
              Save Password
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Deactivate Confirm ────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!deactivateUser}
        onClose={() => setDeactivateUser(null)}
        onConfirm={handleDeactivate}
        title="Deactivate User"
        message={`Deactivate '${deactivateUser?.username}'? They will no longer be able to log in. You can reactivate them later.`}
        confirmLabel="Deactivate"
        danger
      />

    </div>
  )
}
