/**
 * Create / Edit Product modal.
 * Handles both new products (with initial variants) and editing existing products.
 */

import { useState, useEffect } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Loader2, Camera, Hash, X, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import LabelScanModal from './LabelScanModal'
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
  initial_stock:   z.coerce.number().min(0).default(0),
  initial_serials: z.array(z.string()).optional().default([]),
})

const productSchema = z.object({
  name:          z.string().min(1, 'Product name required'),
  description:   z.string().optional(),
  brand_id:      z.coerce.number().optional().nullable(),
  category_id:   z.coerce.number().optional().nullable(),
  // Radio buttons always return strings — coerce "true"/"false" to boolean
  is_serialized: z.union([z.boolean(), z.string()]).transform(v =>
    v === true || v === 'true'
  ),
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

  const { register, control, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      is_serialized: 'true' as any,
      variants: [{ name: 'Standard', sku: '', barcode: '', cost_price: 0, selling_price: 0, warranty_months: 12, reorder_level: 5, initial_stock: 0, initial_serials: [] }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'variants' })

  // Photo / Label scan modal state
  const [scanModal, setScanModal] = useState<{
    isOpen: boolean
    variantIndex: number
    targetField?: 'barcode' | 'sku' | 'serial' | 'all'
  }>({
    isOpen: false,
    variantIndex: 0,
    targetField: 'all',
  })

  // Per-variant manual serial input text state
  const [serialInputs, setSerialInputs] = useState<Record<number, string>>({})

  // Populate form when editing
  useEffect(() => {
    if (editProduct) {
      reset({
        name:          editProduct.name,
        description:   editProduct.description ?? '',
        brand_id:      editProduct.brand_id ?? undefined,
        category_id:   editProduct.category_id ?? undefined,
        is_serialized: editProduct.is_serialized ? 'true' as any : 'false' as any,
        variants:      editProduct.variants.map(v => ({
          name:            v.name,
          sku:             v.sku ?? '',
          barcode:         v.barcode ?? '',
          cost_price:      Number(v.cost_price),
          selling_price:   Number(v.selling_price),
          warranty_months: v.warranty_months,
          reorder_level:   v.reorder_level,
          initial_stock:   v.current_stock,
          initial_serials: [],
        })),
      })
    } else {
      reset({
        is_serialized: 'true' as any,
        variants: [{ name: 'Standard', sku: '', barcode: '', cost_price: 0, selling_price: 0, warranty_months: 12, reorder_level: 5, initial_stock: 0, initial_serials: [] }],
      })
    }
  }, [editProduct, isOpen, reset])

  const openScanModal = (variantIndex: number, targetField: 'barcode' | 'sku' | 'serial' | 'all' = 'all') => {
    setScanModal({
      isOpen: true,
      variantIndex,
      targetField,
    })
  }

  const handleApplyCodesToVariant = (codes: { barcode?: string; sku?: string; serials?: string[] }) => {
    const idx = scanModal.variantIndex
    if (codes.barcode !== undefined) {
      setValue(`variants.${idx}.barcode`, codes.barcode, { shouldDirty: true })
    }
    if (codes.sku !== undefined) {
      setValue(`variants.${idx}.sku`, codes.sku, { shouldDirty: true })
    }
    if (codes.serials && codes.serials.length > 0) {
      const currentSerials = (watch(`variants.${idx}.initial_serials`) || []) as string[]
      const combined = [...currentSerials]
      for (const s of codes.serials) {
        const trimmed = s.trim()
        if (trimmed && !combined.includes(trimmed)) {
          combined.push(trimmed)
        }
      }
      setValue(`variants.${idx}.initial_serials`, combined, { shouldDirty: true })
      const currentStock = Number(watch(`variants.${idx}.initial_stock`) || 0)
      if (combined.length > currentStock) {
        setValue(`variants.${idx}.initial_stock`, combined.length, { shouldDirty: true })
      }
    }
  }

  const addSerialToVariant = (variantIndex: number, rawSerial?: string) => {
    const val = (rawSerial || serialInputs[variantIndex] || '').trim()
    if (!val) return
    const current = (watch(`variants.${variantIndex}.initial_serials`) || []) as string[]
    if (current.includes(val)) {
      toast.error(`Serial "${val}" is already added`)
      return
    }
    const updated = [...current, val]
    setValue(`variants.${variantIndex}.initial_serials`, updated, { shouldDirty: true })
    const currentStock = Number(watch(`variants.${variantIndex}.initial_stock`) || 0)
    if (updated.length > currentStock) {
      setValue(`variants.${variantIndex}.initial_stock`, updated.length, { shouldDirty: true })
    }
    setSerialInputs(prev => ({ ...prev, [variantIndex]: '' }))
  }

  const removeSerialFromVariant = (variantIndex: number, serialIndex: number) => {
    const current = (watch(`variants.${variantIndex}.initial_serials`) || []) as string[]
    const updated = current.filter((_, i) => i !== serialIndex)
    setValue(`variants.${variantIndex}.initial_serials`, updated, { shouldDirty: true })
  }

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
            await productService.updateVariant(editProduct.variants[i].id, {
              ...vData,
              current_stock: vData.initial_stock,
            })
          } else {
            await productService.addVariant(editProduct.id, {
              ...vData,
              sku: vData.sku || undefined,
              barcode: vData.barcode || undefined,
              initial_stock: vData.initial_stock,
              initial_serials: vData.initial_serials || [],
            })
          }
        }
        toast.success('Product updated')
      } else {
        await productService.create({
          name:          data.name,
          description:   data.description,
          brand_id:      data.brand_id ?? null,
          category_id:   data.category_id ?? null,
          is_serialized: data.is_serialized as boolean,
          variants:      data.variants.map(v => ({
            name:            v.name,
            sku:             v.sku || undefined,
            barcode:         v.barcode || undefined,
            cost_price:      v.cost_price,
            selling_price:   v.selling_price,
            warranty_months: v.warranty_months,
            reorder_level:   v.reorder_level,
            initial_stock:   v.initial_stock,
            initial_serials: v.initial_serials || [],
          })),
        })
        toast.success('Product created with initial variants & serials')
      }
      onClose()
      onSaved()   // refresh list AFTER modal closes so it's visible
    } catch { /* interceptor */ }
  }

  return (
    <>
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
                onClick={() => append({ name: '', sku: '', barcode: '', cost_price: 0, selling_price: 0, warranty_months: 12, reorder_level: 5, initial_stock: 0, initial_serials: [] })}
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
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openScanModal(index, 'all')}
                        className="text-xs bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
                        title="Upload or snap photo of label to auto-detect Barcode, SKU & Serials"
                      >
                        <Camera size={13} className="text-primary-600" />
                        <span>Scan Label Picture</span>
                      </button>
                      {fields.length > 1 && (
                        <button type="button" onClick={() => remove(index)} className="text-red-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
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
                      <div className="flex items-center justify-between">
                        <label className="label">SKU</label>
                        <button
                          type="button"
                          onClick={() => openScanModal(index, 'sku')}
                          className="text-[11px] text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium"
                          title="Scan picture for SKU"
                        >
                          <Camera size={11} /> Scan Picture
                        </button>
                      </div>
                      <input className="input" placeholder="e.g. AK820-WL-BLU" {...register(`variants.${index}.sku`)} />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <label className="label">Barcode</label>
                        <button
                          type="button"
                          onClick={() => openScanModal(index, 'barcode')}
                          className="text-[11px] text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium"
                          title="Scan picture for Barcode"
                        >
                          <Camera size={11} /> Scan Picture
                        </button>
                      </div>
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

                    <div className="col-span-2 sm:col-span-1">
                      <label className="label text-primary-700 font-semibold">
                        {isEdit ? 'Stock (Units)' : 'Initial Stock (Units)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        className="input border-primary-300 focus:ring-primary-500 font-medium"
                        placeholder="0"
                        {...register(`variants.${index}.initial_stock`)}
                      />
                    </div>

                    {/* Initial Serial Numbers section for Serialized products */}
                    {watch('is_serialized') && !isEdit && (
                      <div className="col-span-2 p-3 bg-white border border-gray-200 rounded-lg space-y-2 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
                            <Hash size={13} className="text-primary-600" />
                            Initial Serial Numbers
                            <span className="text-xs font-normal text-gray-400">
                              ({((watch(`variants.${index}.initial_serials`) as string[]) || []).length} entered)
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() => openScanModal(index, 'serial')}
                            className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                            title="Scan photo for serial numbers"
                          >
                            <Camera size={12} /> Scan Picture for Serials
                          </button>
                        </div>

                        {/* Serial chips */}
                        {((watch(`variants.${index}.initial_serials`) as string[]) || []).length > 0 && (
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-gray-50 rounded border border-gray-100">
                            {((watch(`variants.${index}.initial_serials`) as string[]) || []).map((sn, sIdx) => (
                              <span
                                key={sIdx}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-primary-100 text-primary-800 border border-primary-200"
                              >
                                {sn}
                                <button
                                  type="button"
                                  onClick={() => removeSerialFromVariant(index, sIdx)}
                                  className="text-primary-600 hover:text-red-500 ml-0.5"
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Manual text entry */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Type or paste serial number & press Add"
                            className="input text-xs py-1.5 flex-1 font-mono"
                            value={serialInputs[index] || ''}
                            onChange={(e) => setSerialInputs(prev => ({ ...prev, [index]: e.target.value }))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                addSerialToVariant(index)
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => addSerialToVariant(index)}
                            className="btn-secondary text-xs py-1.5 px-3 font-medium"
                          >
                            + Add
                          </button>
                        </div>
                      </div>
                    )}

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

      {/* Picture Upload / Camera Scan Modal */}
      <LabelScanModal
        isOpen={scanModal.isOpen}
        onClose={() => setScanModal(prev => ({ ...prev, isOpen: false }))}
        variantIndex={scanModal.variantIndex}
        variantName={watch(`variants.${scanModal.variantIndex}.name`)}
        targetField={scanModal.targetField}
        onApplyCodes={handleApplyCodesToVariant}
      />
    </>
  )
}
