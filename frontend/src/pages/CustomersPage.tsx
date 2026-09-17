/**
 * Customers page — Phase 7.
 *
 * Shows paginated list of customers with:
 * - Search by name or phone
 * - Filter by type (RETAIL / WHOLESALE)
 * - Create / edit modal (react-hook-form + zod)
 * - Permission-gated actions (manage_customers)
 */

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Search, Pencil, Users, Loader2,
  Phone, Mail, Star, ChevronLeft, ChevronRight,
  RotateCcw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import {
  customerService,
  type CustomerListItem,
  type Customer,
  type CustomerType,
} from '@/services/customerService'
import { useAuthStore } from '@/services/authStore'
import { formatDate } from '@/utils/format'

// ─── Form schema ──────────────────────────────────────────────────────────────

const schema = z.object({
  name:          z.string().min(1, 'Name is required').trim(),
  phone:         z.string().optional(),
  email:         z.string().email('Invalid email').optional().or(z.literal('')),
  address:       z.string().optional(),
  customer_type: z.enum(['RETAIL', 'WHOLESALE']),
  notes:         z.string().optional(),
})
type FormData = z.infer<typeof schema>

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<CustomerType, 'blue' | 'purple'> = {
  RETAIL:    'blue',
  WHOLESALE: 'purple',
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomersPage() {
  const { hasPermission } = useAuthStore()
  const canEdit = hasPermission('manage_customers')

  const [items, setItems]           = useState<CustomerListItem[]>([])
  const [total, setTotal]           = useState(0)
  const [pages, setPages]           = useState(1)
  const [page, setPage]             = useState(1)
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showModal, setShowModal]   = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { customer_type: 'RETAIL' },
  })

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await customerService.list({
        search:        search || undefined,
        customer_type: typeFilter || undefined,
        page,
        per_page: 20,
      })
      setItems(res.items)
      setTotal(res.total)
      setPages(res.pages)
    } catch { /* interceptor */ }
    finally { setLoading(false) }
  }, [search, typeFilter, page])

  useEffect(() => { setPage(1) }, [search, typeFilter])
  useEffect(() => { fetchData() }, [fetchData])

  // ── Modal helpers ─────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditCustomer(null)
    form.reset({ name: '', phone: '', email: '', address: '', customer_type: 'RETAIL', notes: '' })
    setShowModal(true)
  }

  const openEdit = async (id: number) => {
    try {
      const c = await customerService.get(id)
      setEditCustomer(c)
      form.reset({
        name:          c.name,
        phone:         c.phone ?? '',
        email:         c.email ?? '',
        address:       c.address ?? '',
        customer_type: c.customer_type,
        notes:         c.notes ?? '',
      })
      setShowModal(true)
    } catch { toast.error('Failed to load customer') }
  }

  const onSubmit = async (data: FormData) => {
    try {
      const payload = { ...data, email: data.email || undefined }
      editCustomer
        ? await customerService.update(editCustomer.id, payload)
        : await customerService.create(payload)
      toast.success(editCustomer ? 'Customer updated' : 'Customer created')
      setShowModal(false)
      fetchData()
    } catch { /* interceptor */ }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Customers</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} customer{total !== 1 ? 's' : ''}</p>
        </div>
        {canEdit && (
          <button className="btn-primary flex items-center gap-2" onClick={openCreate}>
            <Plus size={16} /> New Customer
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search by name or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          className="input w-auto min-w-[140px]"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          <option value="RETAIL">Retail</option>
          <option value="WHOLESALE">Wholesale</option>
        </select>

        {(search || typeFilter) && (
          <button
            className="btn-secondary flex items-center gap-1.5"
            onClick={() => { setSearch(''); setTypeFilter('') }}
          >
            <RotateCcw size={14} /> Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-primary-500" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users size={40} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">No customers yet</p>
            {canEdit && (
              <button onClick={openCreate} className="mt-3 text-sm text-primary-600 hover:underline">
                Add your first customer
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Customer</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Contact</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Type</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Loyalty</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Sales</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Added</th>
                    {canEdit && <th className="px-5 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary-50 flex items-center justify-center text-primary-500 font-semibold text-sm flex-shrink-0">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{c.name}</p>
                            {c.email && (
                              <p className="text-xs text-gray-400 flex items-center gap-1">
                                <Mail size={10} /> {c.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {c.phone ? (
                          <p className="text-sm text-gray-600 flex items-center gap-1.5">
                            <Phone size={12} className="text-gray-400" /> {c.phone}
                          </p>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={TYPE_COLORS[c.customer_type]}>
                          {c.customer_type === 'WHOLESALE' ? 'Wholesale' : 'Retail'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="flex items-center gap-1.5 text-gray-700">
                          <Star size={13} className={c.loyalty_points > 0 ? 'text-yellow-400' : 'text-gray-300'} />
                          {c.loyalty_points}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">{c.sale_count}</td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs">{formatDate(c.created_at)}</td>
                      {canEdit && (
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => openEdit(c.id)}
                            className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                            aria-label={`Edit ${c.name}`}
                          >
                            <Pencil size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500">Page {page} of {pages} — {total} total</p>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="btn-secondary py-1 px-2 disabled:opacity-40"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    disabled={page >= pages}
                    onClick={() => setPage(p => p + 1)}
                    className="btn-secondary py-1 px-2 disabled:opacity-40"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create / Edit modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editCustomer ? 'Edit Customer' : 'New Customer'}
        maxWidth="md"
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">

            {/* Name */}
            <div className="col-span-2">
              <label className="label">Name *</label>
              <input
                className="input"
                placeholder="e.g. Rahim Uddin"
                {...form.register('name')}
              />
              {form.formState.errors.name && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.name.message}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                placeholder="01XXXXXXXXX"
                {...form.register('phone')}
              />
            </div>

            {/* Email */}
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                placeholder="customer@email.com"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.email.message}</p>
              )}
            </div>

            {/* Customer type */}
            <div>
              <label className="label">Customer Type</label>
              <select className="input" {...form.register('customer_type')}>
                <option value="RETAIL">Retail</option>
                <option value="WHOLESALE">Wholesale</option>
              </select>
            </div>

            {/* Address */}
            <div>
              <label className="label">Address</label>
              <input
                className="input"
                placeholder="Dhaka, Bangladesh"
                {...form.register('address')}
              />
            </div>

            {/* Notes */}
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea
                className="input"
                rows={2}
                placeholder="Optional notes…"
                {...form.register('notes')}
              />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-1 border-t border-gray-100">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex items-center gap-2"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting
                ? <Loader2 size={15} className="animate-spin" />
                : null
              }
              {editCustomer ? 'Save Changes' : 'Create Customer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
