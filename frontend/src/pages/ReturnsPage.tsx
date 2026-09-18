/**
 * Returns & Damaged Products page — Phase 11.
 *
 * List of all returns with:
 *   - Return number, linked sale, customer, date
 *   - Item count, refund amount, refund status
 *   - Update refund status inline
 *
 * File Return modal:
 *   - Optional: link to a sale (fetches sale's items to pick from)
 *   - Per item: condition (GOOD = re-stock, DAMAGED = write-off)
 *   - For serialized items: enter serial number
 *   - Reason text + refund amount + refund status
 */

import { useEffect, useState, useCallback } from 'react'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Plus, Loader2, RotateCcw, ChevronLeft, ChevronRight,
  PackageX, Trash2, Pencil, Search,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import returnsService, {
  type ReturnListItem, type ReturnDetail, type RefundStatus,
} from '@/services/returnsService'
import { saleService, type Sale } from '@/services/saleService'
import { useAuthStore } from '@/services/authStore'
import { formatCurrency, formatDate } from '@/utils/format'

// ─── Badge helpers ────────────────────────────────────────────────────────────

const REFUND_BADGE: Record<RefundStatus, 'yellow' | 'green' | 'blue' | 'gray'> = {
  PENDING:  'yellow',
  ISSUED:   'green',
  EXCHANGE: 'blue',
  NONE:     'gray',
}

// ─── File Return Modal ────────────────────────────────────────────────────────

const itemSchema = z.object({
  variant_id: z.number(),
  serial_id:  z.number().optional(),
  serial_str: z.string().optional(),   // used only for serialized — looked up on submit
  quantity:   z.number().min(1),
  condition:  z.enum(['GOOD', 'DAMAGED']),
  product_name: z.string().optional(),
  variant_name: z.string().optional(),
  is_serialized: z.boolean().optional(),
  notes:      z.string().optional(),
})

const returnSchema = z.object({
  sale_number_input: z.string().optional(),
  customer_id:  z.number().optional(),
  return_date:  z.string().min(1, 'Date required'),
  reason:       z.string().min(3, 'Reason required'),
  refund_amount: z.coerce.number().min(0),
  refund_status: z.enum(['PENDING', 'ISSUED', 'EXCHANGE', 'NONE']),
  notes:        z.string().optional(),
  items:        z.array(itemSchema).min(1, 'Add at least one item'),
})
type ReturnFormData = z.infer<typeof returnSchema>

function FileReturnModal({
  isOpen, onClose, onCreated,
}: {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [saleSearch, setSaleSearch]   = useState('')
  const [loadingSale, setLoadingSale] = useState(false)
  const [linkedSale, setLinkedSale]   = useState<Sale | null>(null)
  const [saleError, setSaleError]     = useState('')

  const today = new Date().toISOString().slice(0, 10)

  const { register, control, handleSubmit, reset, watch,
          formState: { errors, isSubmitting } } = useForm<ReturnFormData>({
    resolver: zodResolver(returnSchema),
    defaultValues: {
      return_date: today,
      refund_status: 'PENDING',
      refund_amount: 0,
      items: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      reset({ return_date: today, refund_status: 'PENDING', refund_amount: 0, items: [] })
      setLinkedSale(null)
      setSaleSearch('')
      setSaleError('')
    }
  }, [isOpen, reset, today])

  const lookupSale = async () => {
    if (!saleSearch.trim()) return
    setLoadingSale(true)
    setSaleError('')
    try {
      // List sales and find by sale_number
      const res = await saleService.list({ per_page: 100 })
      const found = res.items.find(
        s => s.sale_number.toLowerCase() === saleSearch.trim().toLowerCase()
      )
      if (!found) { setSaleError('Sale not found'); setLinkedSale(null); return }
      // Fetch full detail
      const sale = await saleService.get(found.id)
      setLinkedSale(sale)
      // Pre-populate items from sale
      for (const item of sale.items) {
        // Add one row per item
        append({
          variant_id:    item.variant_id,
          product_name:  item.product_name ?? '',
          variant_name:  item.variant_name ?? '',
          is_serialized: false,   // we don't know from sale item — user sets serial manually
          quantity:      item.quantity,
          condition:     'GOOD',
          serial_str:    '',
        })
      }
    } catch { setSaleError('Failed to load sale') }
    finally { setLoadingSale(false) }
  }

  const onSubmit = async (data: ReturnFormData) => {
    try {
      await returnsService.create({
        sale_id:       linkedSale?.id,
        customer_id:   linkedSale?.customer_id ?? undefined,
        return_date:   data.return_date,
        reason:        data.reason,
        refund_amount: data.refund_amount,
        refund_status: data.refund_status,
        notes:         data.notes || undefined,
        items: data.items.map(i => ({
          variant_id: i.variant_id,
          serial_id:  i.serial_id,
          quantity:   i.quantity,
          condition:  i.condition,
          notes:      i.notes || undefined,
        })),
      })
      toast.success('Return recorded')
      onClose()
      onCreated()
    } catch { /* interceptor */ }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="File Return" maxWidth="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

        {/* ── Link to sale ──────────────────────────────────────────── */}
        <div>
          <label className="label">Link to Sale (optional)</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                className="input pl-9 font-mono"
                placeholder="SO-2026-00001"
                value={saleSearch}
                onChange={e => setSaleSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), lookupSale())}
              />
            </div>
            <button type="button" className="btn-secondary" onClick={lookupSale} disabled={loadingSale}>
              {loadingSale ? <Loader2 size={14} className="animate-spin" /> : 'Look up'}
            </button>
          </div>
          {saleError && <p className="mt-1 text-xs text-red-600">{saleError}</p>}
          {linkedSale && (
            <p className="mt-1 text-xs text-green-600">
              ✓ Linked: {linkedSale.sale_number}
              {linkedSale.customer_name ? ` — ${linkedSale.customer_name}` : ' — Walk-in'}
            </p>
          )}
        </div>

        {/* ── Return details ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Return Date *</label>
            <input type="date" className="input" {...register('return_date')} />
            {errors.return_date && <p className="mt-1 text-xs text-red-600">{errors.return_date.message}</p>}
          </div>
          <div>
            <label className="label">Refund Amount (৳)</label>
            <input type="number" step="0.01" min="0" className="input" placeholder="0" {...register('refund_amount')} />
          </div>
          <div>
            <label className="label">Refund Status</label>
            <select className="input" {...register('refund_status')}>
              <option value="PENDING">Pending</option>
              <option value="ISSUED">Issued</option>
              <option value="EXCHANGE">Exchange</option>
              <option value="NONE">None</option>
            </select>
          </div>
          <div>
            <label className="label">Reason *</label>
            <input className="input" placeholder="e.g. Defective unit, wrong item" {...register('reason')} />
            {errors.reason && <p className="mt-1 text-xs text-red-600">{errors.reason.message}</p>}
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} {...register('notes')} />
          </div>
        </div>

        {/* ── Items ──────────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Items *</label>
            <button
              type="button"
              className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1"
              onClick={() => append({
                variant_id: 0, product_name: '', variant_name: '',
                quantity: 1, condition: 'GOOD', serial_str: '',
              })}
            >
              <Plus size={12} /> Add item manually
            </button>
          </div>

          {errors.items && typeof errors.items === 'object' && 'message' in errors.items && (
            <p className="mb-2 text-xs text-red-600">{(errors.items as { message: string }).message}</p>
          )}

          {fields.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">
              Link a sale above to auto-populate items, or add manually.
            </p>
          ) : (
            <div className="space-y-2">
              {fields.map((field, idx) => {
                const item = watch(`items.${idx}`)
                return (
                  <div key={field.id} className="grid grid-cols-12 gap-2 items-start p-3 bg-gray-50 rounded-xl">
                    {/* Product info */}
                    <div className="col-span-3">
                      <p className="text-xs font-medium text-gray-700 truncate">{item.product_name || '—'}</p>
                      <p className="text-xs text-gray-500 truncate">{item.variant_name || 'Variant'}</p>
                      {/* Hidden variant_id */}
                      <input type="hidden" {...register(`items.${idx}.variant_id`, { valueAsNumber: true })} />
                    </div>

                    {/* Qty */}
                    <div className="col-span-1">
                      <label className="text-xs text-gray-500">Qty</label>
                      <input
                        type="number" min={1}
                        className="input py-1 text-sm text-center"
                        {...register(`items.${idx}.quantity`, { valueAsNumber: true })}
                      />
                    </div>

                    {/* Serial (optional) */}
                    <div className="col-span-3">
                      <label className="text-xs text-gray-500">Serial # (if serialized)</label>
                      <input
                        className="input py-1 text-sm font-mono uppercase"
                        placeholder="Optional"
                        {...register(`items.${idx}.serial_str`)}
                      />
                    </div>

                    {/* Condition */}
                    <div className="col-span-3">
                      <label className="text-xs text-gray-500">Condition</label>
                      <select className="input py-1 text-sm" {...register(`items.${idx}.condition`)}>
                        <option value="GOOD">Good — re-stock</option>
                        <option value="DAMAGED">Damaged — write-off</option>
                      </select>
                    </div>

                    {/* Remove */}
                    <div className="col-span-2 flex items-end justify-end">
                      <button type="button" onClick={() => remove(idx)}
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-2 border-t border-gray-100">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Record Return
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Update Refund Modal ──────────────────────────────────────────────────────

function UpdateRefundModal({
  ret, onClose, onUpdated,
}: {
  ret: ReturnListItem | null
  onClose: () => void
  onUpdated: () => void
}) {
  const [status, setStatus] = useState<RefundStatus>('PENDING')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (ret) setStatus(ret.refund_status)
  }, [ret])

  const save = async () => {
    if (!ret) return
    setSaving(true)
    try {
      await returnsService.updateRefundStatus(ret.id, status)
      toast.success('Refund status updated')
      onClose()
      onUpdated()
    } catch { /* interceptor */ }
    finally { setSaving(false) }
  }

  if (!ret) return null

  return (
    <Modal isOpen={!!ret} onClose={onClose} title={`Update Refund — ${ret.return_number}`} maxWidth="sm">
      <div className="space-y-4">
        <div>
          <label className="label">Refund Status</label>
          <select className="input" value={status} onChange={e => setStatus(e.target.value as RefundStatus)}>
            <option value="PENDING">Pending</option>
            <option value="ISSUED">Issued</option>
            <option value="EXCHANGE">Exchange</option>
            <option value="NONE">None</option>
          </select>
        </div>
        <div className="flex gap-3 justify-end pt-1 border-t border-gray-100">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary flex items-center gap-2" onClick={save} disabled={saving}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : null}
            Save
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReturnsPage() {
  const { hasPermission } = useAuthStore()
  const canManage = hasPermission('manage_returns')
  const canView   = hasPermission('view_returns')

  const [items, setItems]     = useState<ReturnListItem[]>([])
  const [total, setTotal]     = useState(0)
  const [pages, setPages]     = useState(1)
  const [page, setPage]       = useState(1)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingRefund, setEditingRefund] = useState<ReturnListItem | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await returnsService.list({ page, per_page: 20 })
      setItems(res.items)
      setTotal(res.total)
      setPages(res.pages)
    } catch { /* interceptor */ }
    finally { setLoading(false) }
  }, [page])

  useEffect(() => { fetchData() }, [fetchData])

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Returns</h2>
          <p className="text-sm text-gray-500 mt-0.5">{total} return{total !== 1 ? 's' : ''} recorded</p>
        </div>
        {canManage && (
          <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New Return
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
            <PackageX size={40} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">No returns yet</p>
            {canManage && (
              <button onClick={() => setShowCreate(true)} className="mt-3 text-sm text-primary-600 hover:underline">
                Record your first return
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Return #</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Sale</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Customer</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-600">Items</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-600">Refund</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                    {canManage && <th className="px-5 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {items.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-sm text-primary-600 font-medium">{r.return_number}</td>
                      <td className="px-5 py-3.5 font-mono text-xs text-gray-600">
                        {r.sale_number ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">
                        {r.customer_name ?? <span className="text-gray-400">Walk-in</span>}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{formatDate(r.return_date)}</td>
                      <td className="px-5 py-3.5 text-gray-700 text-right">{r.item_count}</td>
                      <td className="px-5 py-3.5 text-right font-semibold text-gray-900">
                        {Number(r.refund_amount) > 0 ? formatCurrency(r.refund_amount) : '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={REFUND_BADGE[r.refund_status]}>
                          {r.refund_status}
                        </Badge>
                      </td>
                      {canManage && (
                        <td className="px-5 py-3.5">
                          {r.refund_status === 'PENDING' && (
                            <button
                              onClick={() => setEditingRefund(r)}
                              className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                              title="Update refund status"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500">Page {page} of {pages} — {total} total</p>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-2 disabled:opacity-40">
                    <ChevronLeft size={15} />
                  </button>
                  <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-2 disabled:opacity-40">
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <FileReturnModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={fetchData}
      />
      <UpdateRefundModal
        ret={editingRefund}
        onClose={() => setEditingRefund(null)}
        onUpdated={fetchData}
      />
    </div>
  )
}
