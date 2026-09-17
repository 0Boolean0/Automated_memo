/**
 * Catalog page — manages Categories and Brands.
 * Tabs: Categories | Brands
 */

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Loader2, Tag, Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import Badge from '@/components/ui/Badge'
import { categoryService, brandService, type Category, type Brand } from '@/services/productService'
import { useAuthStore } from '@/services/authStore'

const nameSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
})
type NameForm = z.infer<typeof nameSchema>

type Tab = 'categories' | 'brands'

function ItemRow({
  label, description, isActive, onEdit, onDelete, canEdit,
}: {
  label: string; description?: string | null; isActive: boolean
  onEdit: () => void; onDelete: () => void; canEdit: boolean
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm">
          {label.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{label}</p>
          {description && <p className="text-xs text-gray-400">{description}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={isActive ? 'green' : 'gray'}>{isActive ? 'Active' : 'Inactive'}</Badge>
        {canEdit && (
          <>
            <button onClick={onEdit} className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
              <Pencil size={14} />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function CatalogPage() {
  const { hasPermission } = useAuthStore()
  const canEdit = hasPermission('create_product')
  const [tab, setTab] = useState<Tab>('categories')

  // ── State ──────────────────────────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Category | Brand | null>(null)
  const [deleteItem, setDeleteItem] = useState<Category | Brand | null>(null)

  const form = useForm<NameForm>({ resolver: zodResolver(nameSchema) })

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [cats, brds] = await Promise.all([categoryService.list(), brandService.list()])
      setCategories(cats)
      setBrands(brds)
    } catch { toast.error('Failed to load catalog') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  const openCreate = () => { setEditItem(null); form.reset({ name: '', description: '' }); setShowModal(true) }
  const openEdit = (item: Category | Brand) => { setEditItem(item); form.reset({ name: item.name, description: item.description ?? '' }); setShowModal(true) }

  const onSubmit = async (data: NameForm) => {
    try {
      if (tab === 'categories') {
        editItem
          ? await categoryService.update(editItem.id, { name: data.name, description: data.description })
          : await categoryService.create({ name: data.name, description: data.description })
      } else {
        editItem
          ? await brandService.update(editItem.id, { name: data.name, description: data.description })
          : await brandService.create({ name: data.name, description: data.description })
      }
      toast.success(editItem ? 'Updated!' : 'Created!')
      setShowModal(false)
      fetchAll()
    } catch { /* interceptor */ }
  }

  const onDelete = async () => {
    if (!deleteItem) return
    try {
      tab === 'categories'
        ? await categoryService.delete(deleteItem.id)
        : await brandService.delete(deleteItem.id)
      toast.success('Deleted')
      fetchAll()
    } catch { /* interceptor */ }
  }

  const items = tab === 'categories' ? categories : brands

  return (
    <div className="max-w-2xl space-y-5">
      {/* Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
          {(['categories', 'brands'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize
                ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t === 'categories' ? <Layers size={15} /> : <Tag size={15} />}
              {t}
            </button>
          ))}
        </div>
        {canEdit && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
            <Plus size={15} />
            New {tab === 'categories' ? 'Category' : 'Brand'}
          </button>
        )}
      </div>

      {/* List */}
      <div className="card p-3">
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-primary-500" /></div>
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-gray-400 py-10">
            No {tab} yet. {canEdit && 'Create one above.'}
          </p>
        ) : (
          <div className="space-y-0.5">
            {items.map(item => (
              <ItemRow
                key={item.id}
                label={item.name}
                description={item.description}
                isActive={item.is_active}
                onEdit={() => openEdit(item)}
                onDelete={() => setDeleteItem(item)}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? `Edit ${tab === 'categories' ? 'Category' : 'Brand'}` : `New ${tab === 'categories' ? 'Category' : 'Brand'}`}
        maxWidth="sm"
      >
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Name *</label>
            <input className="input" placeholder="e.g. Keyboards" {...form.register('name')} />
            {form.formState.errors.name && <p className="mt-1 text-xs text-red-600">{form.formState.errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" placeholder="Optional" {...form.register('description')} />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? <Loader2 size={15} className="animate-spin" /> : editItem ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={onDelete}
        title={`Delete ${tab === 'categories' ? 'Category' : 'Brand'}`}
        message={`Deactivate "${deleteItem?.name}"? Products in this ${tab === 'categories' ? 'category' : 'brand'} will not be deleted.`}
        confirmLabel="Deactivate"
        danger
      />
    </div>
  )
}
