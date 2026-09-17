/**
 * Suppliers list + create/edit page.
 */

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Search, Pencil, Truck, Loader2,
  Phone, Mail, ShoppingBag,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import { supplierService, type SupplierListItem, type Supplier } from '@/services/supplierService'
import { useAuthStore } from '@/services/authStore'
import { formatDate } from '@/utils/format'

const schema = z.object({
  name:    z.string().min(1, 'Name is required'),
  company: z.string().optional(),
  phone:   z.string().optional(),
  email:   z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  notes:   z.string().optional(),
})
type FormData = z.infer<typeof schema>

export default function SuppliersPage() {
  const { hasPermission } = useAuthStore()
  const canEdit = hasPermission('manage_suppliers')

  const [items, setItems]       = useState<SupplierListItem[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null)

  const form = useForm<FormData>({ resolver: zodResolver(schema) })

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await supplierService.list({ search: search || undefined })
      setItems(res.items)
      setTotal(res.total)
    } catch { toast.error('Failed to load suppliers') }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => {
    setEditSupplier(null)
    form.reset({ name: '', company: '', phone: '', email: '', address: '', notes: '' })
    setShowModal(true)
  }

  const openEdit = async (id: number) => {
    try {
      const s = await supplierService.get(id)
      setEditSupplier(s)
      form.reset({
        name: s.name, company: s.company ?? '', phone: s.phone ?? '',
        email: s.email ?? '', address: s.address ?? '', notes: s.notes ?? '',
      })
      setShowModal(true)
    } catch { toast.error('Failed to load supplier') }
  }

  const onSubmit = async (data: FormData) => {
    try {
      const payload = { ...data, email: data.email || undefined }
      editSupplier
        ? await supplierService.update(editSupplier.id, payload)
        : await supplierService.create(payload)
      toast.success(editSupplier ? 'Supplier updated' : 'Supplier created')
      setShowModal(false)
      fetchData()
    } catch { /* interceptor */ }
  }

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Suppliers</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} suppliers</p>
        </div>
        {canEdit && (
          <button className="btn-primary flex items-center gap-2" onClick={openCreate}>
            <Plus size={16} /> New Supplier
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Search suppliers…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Truck size={40} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">No suppliers yet</p>
            {canEdit && (
              <button onClick={openCreate} className="mt-3 text-sm text-primary-600 hover:underline">
                Add your first supplier
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Supplier</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Contact</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Purchases</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-gray-600">Added</th>
                  {canEdit && <th className="px-5 py-3" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-orange-500 flex-shrink-0">
                          <Truck size={17} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{s.name}</p>
                          {s.company && <p className="text-xs text-gray-400">{s.company}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      {s.phone && (
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone size={11} /> {s.phone}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="flex items-center gap-1.5 text-gray-700">
                        <ShoppingBag size={13} className="text-gray-400" />
                        {s.purchase_count}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={s.is_active ? 'green' : 'gray'}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{formatDate(s.created_at)}</td>
                    {canEdit && (
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => openEdit(s.id)}
                          className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
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
        )}
      </div>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editSupplier ? 'Edit Supplier' : 'New Supplier'}
        maxWidth="md"
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Supplier Name *</label>
              <input className="input" placeholder="e.g. Tech Wholesale BD" {...form.register('name')} />
              {form.formState.errors.name && <p className="mt-1 text-xs text-red-600">{form.formState.errors.name.message}</p>}
            </div>
            <div>
              <label className="label">Company</label>
              <input className="input" placeholder="Optional" {...form.register('company')} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" placeholder="01XXXXXXXXX" {...form.register('phone')} />
            </div>
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" {...form.register('email')} />
              {form.formState.errors.email && <p className="mt-1 text-xs text-red-600">{form.formState.errors.email.message}</p>}
            </div>
            <div className="col-span-2">
              <label className="label">Address</label>
              <textarea className="input" rows={2} {...form.register('address')} />
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea className="input" rows={2} placeholder="Optional notes…" {...form.register('notes')} />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 size={15} className="animate-spin" /> : editSupplier ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
