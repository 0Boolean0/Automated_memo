/**
 * Stock adjustment modal — Phase 5.
 *
 * Form for creating inventory adjustments with:
 * - Variant selector
 * - Adjustment type dropdown
 * - Quantity input (positive/negative)
 * - Reason text field (mandatory)
 * - Optional notes
 */

import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Loader2, Search, CheckCircle2, History, ArrowRight } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import inventoryService, { type AdjustmentCreate } from '@/services/inventoryService'
import { productService, type ProductVariant } from '@/services/productService'

const ADJUSTMENT_TYPES = [
  { value: 'PHYSICAL_COUNT', label: 'Physical Count', hint: 'Stock count discrepancy' },
  { value: 'DAMAGE', label: 'Damage', hint: 'Stock damaged and removed' },
  { value: 'LOSS', label: 'Loss', hint: 'Stock lost or stolen' },
  { value: 'TRANSFER', label: 'Transfer', hint: 'Stock transferred' },
  { value: 'RETURN', label: 'Return', hint: 'Return from customer/supplier' },
  { value: 'CORRECTION', label: 'Correction', hint: 'Correction of previous error' },
]

const adjustmentSchema = z.object({
  variant_id: z.number({ invalid_type_error: 'Select a variant' }).min(1),
  adjustment_type: z.string().min(1, 'Select adjustment type'),
  quantity_change: z.number({ invalid_type_error: 'Enter quantity' })
    .refine(v => v !== 0, 'Quantity must be non-zero'),
  reason: z.string().min(5, 'Reason must be at least 5 characters'),
  notes: z.string().optional(),
})

type AdjustmentFormData = z.infer<typeof adjustmentSchema>

interface EnrichedVariant extends ProductVariant {
  product_name?: string
  brand_name?: string | null
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onAdjusted?: () => void
  onSaved?: () => void
  initialVariantId?: number
}

export default function StockAdjustmentModal({ isOpen, onClose, onAdjusted, onSaved, initialVariantId }: Props) {
  const navigate = useNavigate()
  const [variants, setVariants] = useState<EnrichedVariant[]>([])
  const [variantSearch, setVariantSearch] = useState('')
  const [loadingVariants, setLoadingVariants] = useState(false)
  const [successInfo, setSuccessInfo] = useState<{
    productName: string
    variantName: string
    newStock: number
    change: number
  } | null>(null)

  const { register, handleSubmit, reset, formState: { errors, isSubmitting }, watch } = useForm<AdjustmentFormData>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: {
      quantity_change: 1,
      variant_id: initialVariantId,
    },
  })

  const selectedVariantId = watch('variant_id')
  const adjustmentType = watch('adjustment_type')
  const quantityChange = watch('quantity_change')

  // Get current stock of selected variant for display
  const selectedVariant = useMemo(
    () => variants.find(v => v.id === selectedVariantId),
    [selectedVariantId, variants]
  )

  // Pre-select initialVariantId when modal opens or initialVariantId changes
  useEffect(() => {
    if (isOpen) {
      setSuccessInfo(null)
      if (initialVariantId) {
        reset(prev => ({
          ...prev,
          variant_id: initialVariantId,
        }))
      }
    } else {
      setSuccessInfo(null)
    }
  }, [isOpen, initialVariantId, reset])

  // Load all variants once
  useEffect(() => {
    if (!isOpen) return

    const loadVariants = async () => {
      setLoadingVariants(true)
      try {
        let allVariants: EnrichedVariant[] = []
        let page = 1
        let hasMore = true

        while (hasMore) {
          const result = await productService.list({ page, per_page: 100 })
          for (const product of result.items) {
            const enriched = (product.variants ?? []).map(v => ({
              ...v,
              product_name: product.name,
              brand_name: product.brand_name,
            }))
            allVariants = allVariants.concat(enriched)
          }
          hasMore = page < result.pages
          page++
        }

        setVariants(allVariants)
      } catch (error) {
        console.error('Failed to load variants:', error)
        toast.error('Failed to load product variants')
      } finally {
        setLoadingVariants(false)
      }
    }

    loadVariants()
  }, [isOpen])

  // Filter variants based on search
  const filteredVariants = useMemo(() => {
    if (!variantSearch) return variants
    const search = variantSearch.toLowerCase()
    return variants.filter(v => 
      v.name?.toLowerCase().includes(search) ||
      v.sku?.toLowerCase().includes(search) ||
      v.product_name?.toLowerCase().includes(search) ||
      (v.brand_name && v.brand_name.toLowerCase().includes(search))
    )
  }, [variants, variantSearch])

  const onSubmit = async (data: AdjustmentFormData) => {
    try {
      const payload: AdjustmentCreate = {
        variant_id: data.variant_id,
        adjustment_type: data.adjustment_type,
        quantity_change: data.quantity_change,
        reason: data.reason,
        notes: data.notes || undefined,
      }

      await inventoryService.createAdjustment(payload)
      const current = selectedVariant?.current_stock ?? 0
      const updatedStock = Math.max(0, current + data.quantity_change)
      
      setSuccessInfo({
        productName: selectedVariant?.product_name ?? 'Product',
        variantName: selectedVariant?.name ?? 'Variant',
        newStock: updatedStock,
        change: data.quantity_change,
      })

      toast.success(`Stock adjusted! New stock: ${updatedStock} units`)
      reset({
        quantity_change: 1,
        variant_id: undefined,
      })
      setVariantSearch('')
      onAdjusted?.()
      onSaved?.()
    } catch { /* interceptor */ }
  }

  const handleClose = () => {
    setSuccessInfo(null)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Adjust Stock" maxWidth="md">
      {successInfo ? (
        <div className="space-y-5 text-center py-3">
          <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <CheckCircle2 size={26} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Stock Updated Successfully!</h3>
            <p className="text-sm text-gray-600 mt-1">
              {successInfo.productName} — {successInfo.variantName}
            </p>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-sm font-semibold mt-3 border border-emerald-200">
              <span>Updated Stock: {successInfo.newStock} units</span>
              <span className="text-xs font-normal">
                ({successInfo.change > 0 ? `+${successInfo.change}` : successInfo.change})
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-gray-100 flex flex-col sm:flex-row gap-2 justify-center">
            <button
              type="button"
              onClick={() => setSuccessInfo(null)}
              className="btn-secondary text-xs flex items-center justify-center gap-1.5 py-2 px-3"
            >
              Adjust Another Product
            </button>
            <button
              type="button"
              onClick={() => {
                handleClose()
                navigate('/inventory/adjustments')
              }}
              className="btn-secondary text-xs flex items-center justify-center gap-1.5 py-2 px-3 text-blue-700 border-blue-200 hover:bg-blue-50"
            >
              <History size={14} /> View History
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="btn-primary text-xs flex items-center justify-center gap-1.5 py-2 px-4"
            >
              Done <ArrowRight size={14} />
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* ── Variant Selector ─────────────────────────────────────────── */}
        <div>
          <label className="label">Product Variant *</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="input pl-9 mb-2"
              placeholder="Search by name or SKU…"
              value={variantSearch}
              onChange={e => setVariantSearch(e.target.value)}
              disabled={loadingVariants}
            />
          </div>
          <select
            className="input"
            {...register('variant_id', { valueAsNumber: true })}
            disabled={loadingVariants}
          >
            <option value="">— Select Variant —</option>
            {filteredVariants.map(v => {
              const brandPrefix = v.brand_name ? `${v.brand_name} · ` : ''
              const prodPrefix = v.product_name ? `${v.product_name} — ` : ''
              return (
                <option key={v.id} value={v.id}>
                  {brandPrefix}{prodPrefix}{v.name} {v.sku ? `(${v.sku})` : ''} · Stock: {v.current_stock}
                </option>
              )
            })}
          </select>
          {errors.variant_id && <p className="mt-1 text-xs text-red-600">{errors.variant_id.message}</p>}

          {/* Current stock info */}
          {selectedVariant && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-xs text-blue-700">
                <span className="font-semibold">Current Stock:</span> {selectedVariant.current_stock} units
              </p>
              <p className="text-xs text-blue-700 mt-1">
                <span className="font-semibold">After Adjustment:</span>{' '}
                <span className={selectedVariant.current_stock + (quantityChange || 0) < 0 ? 'text-red-600 font-bold' : ''}>
                  {selectedVariant.current_stock + (quantityChange || 0)} units
                </span>
              </p>
            </div>
          )}
        </div>

        {/* ── Adjustment Type ──────────────────────────────────────────── */}
        <div>
          <label className="label">Adjustment Type *</label>
          <select className="input" {...register('adjustment_type')}>
            <option value="">— Select Type —</option>
            {ADJUSTMENT_TYPES.map(type => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          {errors.adjustment_type && <p className="mt-1 text-xs text-red-600">{errors.adjustment_type.message}</p>}

          {/* Type hint */}
          {adjustmentType && (
            <p className="mt-1 text-xs text-gray-500">
              {ADJUSTMENT_TYPES.find(t => t.value === adjustmentType)?.hint}
            </p>
          )}
        </div>

        {/* ── Quantity Change ──────────────────────────────────────────── */}
        <div>
          <label className="label">Quantity Change *</label>
          <div className="flex gap-2">
            <input
              type="number"
              className="input"
              placeholder="e.g. 5 or -3"
              {...register('quantity_change', { valueAsNumber: true })}
            />
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => {
                  const current = watch('quantity_change') || 0
                  reset({ ...watch(), quantity_change: current + 1 })
                }}
                className="btn-secondary px-3"
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => {
                  const current = watch('quantity_change') || 0
                  reset({ ...watch(), quantity_change: current - 1 })
                }}
                className="btn-secondary px-3"
              >
                −1
              </button>
            </div>
          </div>
          {errors.quantity_change && <p className="mt-1 text-xs text-red-600">{errors.quantity_change.message}</p>}
        </div>

        {/* ── Reason ────────────────────────────────────────────────────── */}
        <div>
          <label className="label">Reason *</label>
          <textarea
            className="input"
            rows={3}
            placeholder="Why is this adjustment being made? (e.g., Found 5 units damaged in storage, inventory count mismatch)"
            {...register('reason')}
          />
          {errors.reason && <p className="mt-1 text-xs text-red-600">{errors.reason.message}</p>}
        </div>

        {/* ── Notes ─────────────────────────────────────────────────────── */}
        <div>
          <label className="label">Notes (optional)</label>
          <textarea
            className="input"
            rows={2}
            placeholder="Additional context or reference numbers…"
            {...register('notes')}
          />
        </div>

        {/* ── Actions ───────────────────────────────────────────────────── */}
        <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button
            type="submit"
            disabled={isSubmitting || loadingVariants}
            className="btn-primary flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Recording…
              </>
            ) : (
              <>
                <Plus size={15} />
                Record Adjustment
              </>
            )}
          </button>
        </div>
      </form>
      )}
    </Modal>
  )
}
