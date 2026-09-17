/**
 * Create / Edit Product modal.
 * Handles both new products (with initial variants) and editing existing products.
 */

import { useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import { productService, type Product, type Category, type Brand } from '@/services/productService'

// ─── Validation schema ────────────────────────────────────────────────────────

const variantSchema = z.object({
  name:            z.string().min(1, 'Variant name required'),
  sku:             z.string().optional(),
  barcode:         z.string().optional(),
  cost_price:      z.coerce.number().min(0, 'Must be ≥ 0'),
  selling_price:   z.coerce.number().min(0, 'Must be ≥ 0'),
  warranty_months: z.coerce.number().min(0).default(0),
  reorder_level:   z.coerce.number().min(0).default(5),
})

const productSchema = z.object({
  name:          z.string().min(1, 'Product name required'),
  description:   z.string().optional(),
  brand_id:      z.coerce.number().optional().nullable(),
  category_id:   z.coerce.number().optional().nullable(),
  is_serialized: z.boolean().default(true),
  variants:      z.array(variantSchema).min(1, 'Add at least one variant'),
})

type ProductFormData = z.infer<typeof productSchema>

interface Props {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  editProduct?: Product | null
  categories: Category[]
  brands: Brand[]
}

export default function ProductFormModal({ isOpen, onClose, onSaved, editProduct, categories, brands }: Props) {
  const isEdit = !!editProduct

  const { register, control, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      is_serialized: true,
      variants: [{ name: 'Standard', sku: '', barcode: '', cost_price: 0, selling_price: 0, warranty_months: 12, reorder_level: 5 }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'variants' })

  // Populate form when editing
  useEffect(() => {
    if (editProduct) {
      reset({
        name:          editProduct.name,
        description:   editProduct.description ?? '',
        brand_id:      editProduct.brand_id ?? undefined,
        category_id:   editProduct.category_id ?? undefined,
        is_serialized: editProduct.is_serialized,
        variants:      editProduct.variants.map(v => ({
          name:            v.name,
          sku:             v.sku ?? '',
          barcode:         v.barcode ?? '',
          cost_price:      Number(v.cost_price),
          selling_price:   Number(v.selling_price),
          warranty_months: v.warranty_months,
          reorder_level:   v.reorder_level,
        })),
      })
    } else {
      reset({
        is_serialized: true,
        variants: [{ name: 'Standard', sku: '', barcode: '', cost_price: 0, selling_price: 0, warranty_months: 12, reorder_level: 5 }],
      })
    }
  }, [editProduct, isOpen, reset])

  const onSubmit = async (data: ProductFormData) => {
    try {
      if (isEdit && editProduct) {
        // Update product info
        await productService.update(editProduct.id, {
          name:        data.name,
          description: data.description,
          brand_id:    data.brand_id ?? null,
          category_id: data.category_id ?? null,
        })
        // Update each variant
        for (let i = 0; i < data.variants.length; i++) {
          const vData = data.variants[i]
          if (editProduct.variants[i]) {
            await productService.updateVariant(editProduct.variants[i].id, vData)
          } else {
            await productService.addVariant(editProduct.id, vData)
          }
        }
        toast.success('Product updated')
      } else {
        await productService.create({
          name:          data.name,
          description:   data.description,
          brand_id:      data.brand_id ?? null,
          category_id:   data.category_id ?? null,
          is_serialized: data.is_serialized,
          variants:      data.variants,
        })
        toast.success('Product created')
      }
      onSaved()
      onClose()
    } catch { /* interceptor */ }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Product' : 'New Product'} maxWidth="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* ── Product Info ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Product Name *</label>
            <input className="input" placeholder="e.g. AJAZZ AK820" {...register('name')} />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label className="label">Brand</label>
            <select className="input" {...register('brand_id')}>
              <option value="">— Select Brand —</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Category</label>
            <select className="input" {...register('category_id')}>
              <option value="">— Select Category —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="col-span-2">
            <label className="label">Description</label>
            <textarea className="input" rows={2} placeholder="Optional description..." {...register('description')} />
          </div>

          {!isEdit && (
            <div className="col-span-2">
              <label className="label">Tracking Type</label>
              <div className="flex gap-4 mt-1">
                {[
                  { value: true,  label: 'Serialized',     hint: 'Track each unit by serial number (phones, laptops, keyboards)' },
                  { value: false, label: 'Non-serialized', hint: 'Track total quantity only (cables, mouse pads, accessories)' },
                ].map(opt => (
                  <label key={String(opt.value)} className="flex items-start gap-2 cursor-pointer flex-1 p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                    <input
                      type="radio"
                      {...register('is_serialized')}
                      value={String(opt.value)}
                      defaultChecked={opt.value === true}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{opt.label}</p>
                      <p className="text-xs text-gray-500">{opt.hint}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Variants ─────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-semibold text-gray-900">
              Variants <span className="text-gray-400 font-normal">(colors, sizes, models)</span>
            </label>
            <button
              type="button"
              onClick={() => append({ name: '', sku: '', barcode: '', cost_price: 0, selling_price: 0, warranty_months: 12, reorder_level: 5 })}
              className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium"
            >
              <Plus size={13} /> Add Variant
            </button>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Variant {index + 1}</span>
                  {fields.length > 1 && (
                    <button type="button" onClick={() => remove(index)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="label">Variant Name *</label>
                    <input className="input" placeholder="e.g. Wireless / Blue Switch" {...register(`variants.${index}.name`)} />
                    {errors.variants?.[index]?.name && (
                      <p className="mt-1 text-xs text-red-600">{errors.variants[index]?.name?.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="label">SKU</label>
                    <input className="input" placeholder="e.g. AK820-WL-BLU" {...register(`variants.${index}.sku`)} />
                  </div>

                  <div>
                    <label className="label">Barcode</label>
                    <input className="input" placeholder="e.g. 4712345678901" {...register(`variants.${index}.barcode`)} />
                  </div>

                  <div>
                    <label className="label">Cost Price (৳) *</label>
                    <input type="number" step="0.01" className="input" placeholder="0" {...register(`variants.${index}.cost_price`)} />
                    {errors.variants?.[index]?.cost_price && (
                      <p className="mt-1 text-xs text-red-600">{errors.variants[index]?.cost_price?.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="label">Selling Price (৳) *</label>
                    <input type="number" step="0.01" className="input" placeholder="0" {...register(`variants.${index}.selling_price`)} />
                    {errors.variants?.[index]?.selling_price && (
                      <p className="mt-1 text-xs text-red-600">{errors.variants[index]?.selling_price?.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="label">Warranty (months)</label>
                    <input type="number" className="input" placeholder="12" {...register(`variants.${index}.warranty_months`)} />
                  </div>

                  <div>
                    <label className="label">Reorder Level</label>
                    <input type="number" className="input" placeholder="5" {...register(`variants.${index}.reorder_level`)} />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {errors.variants?.root && (
            <p className="mt-2 text-xs text-red-600">{errors.variants.root.message}</p>
          )}
        </div>

        {/* ── Actions ──────────────────────────────────────────────────── */}
        <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : null}
            {isEdit ? 'Save Changes' : 'Create Product'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
