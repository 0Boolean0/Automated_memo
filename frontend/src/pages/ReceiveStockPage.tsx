/**
 * Receive Stock Wizard — 4 steps:
 *   Step 1: Supplier + purchase details (date, invoice number, payment)
 *   Step 2: Add products/variants + quantities + costs
 *   Step 3: Enter serial numbers (for serialized products)
 *   Step 4: Review & confirm
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ChevronRight, ChevronLeft, Check, Plus, Trash2,
  Loader2, Truck, Package, Tag, ClipboardList,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supplierService, type SupplierListItem } from '@/services/supplierService'
import { productService, categoryService, type Product, type ProductVariant } from '@/services/productService'
import { purchaseService, type PurchaseItemCreate } from '@/services/purchaseService'
import { formatCurrency } from '@/utils/format'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItem {
  variant: ProductVariant
  product: Product
  quantity: number
  unit_cost: number
  serials: string[]    // filled in step 3 for serialized products
}

// ─── Step indicators ─────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Details',  icon: Truck },
  { label: 'Products', icon: Package },
  { label: 'Serials',  icon: Tag },
  { label: 'Confirm',  icon: ClipboardList },
]

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((s, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
            ${i === current ? 'bg-primary-600 text-white' :
              i < current ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-400'}`}>
            <s.icon size={15} />
            <span className="hidden sm:inline">{s.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 flex-1 mx-1 ${i < current ? 'bg-primary-300' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Step 1: Purchase Details ─────────────────────────────────────────────────

const detailSchema = z.object({
  supplier_id:    z.coerce.number().optional().nullable(),
  invoice_number: z.string().optional(),
  purchase_date:  z.string().min(1, 'Date is required'),
  paid_amount:    z.coerce.number().min(0).default(0),
  notes:          z.string().optional(),
})
type DetailForm = z.infer<typeof detailSchema>

function StepDetails({
  suppliers, defaultValues, onNext,
}: { suppliers: SupplierListItem[]; defaultValues: DetailForm; onNext: (d: DetailForm) => void }) {
  const form = useForm<DetailForm>({ resolver: zodResolver(detailSchema), defaultValues })
  return (
    <form onSubmit={form.handleSubmit(onNext)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Supplier</label>
          <select className="input" {...form.register('supplier_id')}>
            <option value="">— Walk-in / Unknown —</option>
            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.company ? ` (${s.company})` : ''}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Purchase Date *</label>
          <input type="date" className="input" {...form.register('purchase_date')} />
          {form.formState.errors.purchase_date && <p className="mt-1 text-xs text-red-600">{form.formState.errors.purchase_date.message}</p>}
        </div>
        <div>
          <label className="label">Supplier Invoice / Challan #</label>
          <input className="input" placeholder="Optional" {...form.register('invoice_number')} />
        </div>
        <div>
          <label className="label">Amount Paid (৳)</label>
          <input type="number" step="0.01" className="input" placeholder="0" {...form.register('paid_amount')} />
        </div>
        <div className="col-span-2">
          <label className="label">Notes</label>
          <textarea className="input" rows={2} placeholder="Optional notes…" {...form.register('notes')} />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" className="btn-primary flex items-center gap-2">
          Next: Add Products <ChevronRight size={16} />
        </button>
      </div>
    </form>
  )
}

// ─── Step 2: Add Products ─────────────────────────────────────────────────────

function StepProducts({
  cart, onAddItem, onRemoveItem, onBack, onNext,
}: {
  cart: CartItem[]
  onAddItem: (item: CartItem) => void
  onRemoveItem: (idx: number) => void
  onBack: () => void
  onNext: () => void
}) {
  const [products, setProducts]         = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [quantity, setQuantity]         = useState(1)
  const [unitCost, setUnitCost]         = useState(0)
  const [loadingProducts, setLoadingProducts] = useState(true)

  useEffect(() => {
    productService.list({ per_page: 200 }).then(r => {
      setProducts(r.items as unknown as Product[])
      setLoadingProducts(false)
    })
  }, [])

  const addToCart = () => {
    if (!selectedProduct || !selectedVariant) { toast.error('Select a product and variant'); return }
    if (quantity < 1) { toast.error('Quantity must be at least 1'); return }
    onAddItem({
      variant: selectedVariant,
      product: selectedProduct,
      quantity,
      unit_cost: unitCost,
      serials: [],
    })
    setSelectedProduct(null)
    setSelectedVariant(null)
    setQuantity(1)
    setUnitCost(0)
  }

  const totalAmount = cart.reduce((s, i) => s + i.quantity * i.unit_cost, 0)

  return (
    <div className="space-y-5">
      {/* Add item row */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
        <p className="text-sm font-semibold text-gray-700">Add Product</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="label">Product</label>
            <select
              className="input"
              value={selectedProduct?.id ?? ''}
              onChange={e => {
                const p = products.find(x => x.id === Number(e.target.value)) ?? null
                setSelectedProduct(p)
                setSelectedVariant(null)
                setUnitCost(0)
              }}
            >
              <option value="">— Select Product —</option>
              {loadingProducts
                ? <option disabled>Loading…</option>
                : products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
              }
            </select>
          </div>

          <div className="col-span-2">
            <label className="label">Variant</label>
            <select
              className="input"
              value={selectedVariant?.id ?? ''}
              disabled={!selectedProduct}
              onChange={e => {
                const v = selectedProduct?.variants?.find(x => x.id === Number(e.target.value)) ?? null
                setSelectedVariant(v)
                if (v) setUnitCost(Number(v.cost_price) || 0)
              }}
            >
              <option value="">— Select Variant —</option>
              {selectedProduct?.variants?.filter(v => v.is_active).map(v => (
                <option key={v.id} value={v.id}>{v.name} {v.sku ? `(${v.sku})` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Qty</label>
            <input
              type="number" min={1} className="input"
              value={quantity} onChange={e => setQuantity(Number(e.target.value))}
            />
          </div>

          <div>
            <label className="label">Unit Cost (৳)</label>
            <input
              type="number" step="0.01" className="input"
              value={unitCost} onChange={e => setUnitCost(Number(e.target.value))}
            />
          </div>

          <div className="col-span-2 flex items-end">
            <button type="button" onClick={addToCart} className="btn-primary w-full flex items-center justify-center gap-2">
              <Plus size={15} /> Add to List
            </button>
          </div>
        </div>
      </div>

      {/* Cart */}
      {cart.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Product / Variant</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Qty</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Unit Cost</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Type</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {cart.map((item, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{item.product.name}</p>
                    <p className="text-xs text-gray-400">{item.variant.name}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-gray-700">{formatCurrency(item.unit_cost)}</td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(item.quantity * item.unit_cost)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${item.product.is_serialized ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                      {item.product.is_serialized ? 'Serialized' : 'Qty'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => onRemoveItem(i)} className="text-red-400 hover:text-red-600">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td colSpan={3} className="px-4 py-3 text-right font-semibold text-gray-700">Total:</td>
                <td className="px-4 py-3 font-bold text-gray-900">{formatCurrency(totalAmount)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button type="button" className="btn-secondary flex items-center gap-2" onClick={onBack}>
          <ChevronLeft size={16} /> Back
        </button>
        <button
          type="button"
          className="btn-primary flex items-center gap-2"
          disabled={cart.length === 0}
          onClick={onNext}
        >
          Next: Serial Numbers <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

// ─── Step 3: Enter Serials ─────────────────────────────────────────────────────

function StepSerials({
  cart, onUpdateSerials, onBack, onNext,
}: {
  cart: CartItem[]
  onUpdateSerials: (idx: number, serials: string[]) => void
  onBack: () => void
  onNext: () => void
}) {
  const serializedItems = cart.filter(i => i.product.is_serialized)

  const handleSerialChange = (cartIdx: number, serialIdx: number, value: string) => {
    const newSerials = [...cart[cartIdx].serials]
    newSerials[serialIdx] = value.trim().toUpperCase()
    onUpdateSerials(cartIdx, newSerials)
  }

  // Initialise serial arrays on mount
  useEffect(() => {
    cart.forEach((item, idx) => {
      if (item.product.is_serialized && item.serials.length !== item.quantity) {
        onUpdateSerials(idx, Array(item.quantity).fill(''))
      }
    })
  }, [])

  const allFilled = serializedItems.every(item =>
    item.serials.length === item.quantity &&
    item.serials.every(s => s.trim().length > 0)
  )

  return (
    <div className="space-y-5">
      {serializedItems.length === 0 ? (
        <div className="card text-center py-8">
          <Check size={32} className="text-green-500 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No serial numbers needed</p>
          <p className="text-sm text-gray-400 mt-1">All items in this purchase are non-serialized.</p>
        </div>
      ) : (
        serializedItems.map((item, cartIdx) => {
          const realIdx = cart.indexOf(item)
          return (
            <div key={cartIdx} className="card space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                  <Tag size={17} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{item.product.name}</p>
                  <p className="text-xs text-gray-500">{item.variant.name} — {item.quantity} unit{item.quantity > 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Array.from({ length: item.quantity }).map((_, si) => (
                  <div key={si} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-6 text-right flex-shrink-0">{si + 1}.</span>
                    <input
                      className={`input text-sm font-mono uppercase ${
                        (item.serials[si] || '').trim().length > 0 ? 'border-green-300 focus:ring-green-400' : ''
                      }`}
                      placeholder={`Serial #${si + 1}`}
                      value={item.serials[si] || ''}
                      onChange={e => handleSerialChange(realIdx, si, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-400">
                {item.serials.filter(s => s.trim().length > 0).length} / {item.quantity} entered
              </p>
            </div>
          )
        })
      )}

      <div className="flex justify-between pt-2">
        <button type="button" className="btn-secondary flex items-center gap-2" onClick={onBack}>
          <ChevronLeft size={16} /> Back
        </button>
        <button
          type="button"
          className="btn-primary flex items-center gap-2"
          disabled={!allFilled && serializedItems.length > 0}
          onClick={onNext}
        >
          Review & Confirm <ChevronRight size={16} />
        </button>
      </div>
    </div>
  )
}

// ─── Step 4: Confirm ──────────────────────────────────────────────────────────

function StepConfirm({
  details, cart, suppliers, onBack, onSubmit, submitting,
}: {
  details: DetailForm
  cart: CartItem[]
  suppliers: SupplierListItem[]
  onBack: () => void
  onSubmit: () => void
  submitting: boolean
}) {
  const totalAmount = cart.reduce((s, i) => s + i.quantity * i.unit_cost, 0)
  const supplier = suppliers.find(s => s.id === Number(details.supplier_id))
  const totalSerials = cart.filter(i => i.product.is_serialized).reduce((s, i) => s + i.serials.length, 0)

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Supplier',     value: supplier?.name ?? 'Walk-in' },
          { label: 'Date',         value: details.purchase_date },
          { label: 'Invoice #',    value: details.invoice_number || '—' },
          { label: 'Total',        value: formatCurrency(totalAmount) },
        ].map(s => (
          <div key={s.label} className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-0.5">{s.label}</p>
            <p className="font-semibold text-gray-900 text-sm">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Items */}
      <div className="card p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
          <p className="font-semibold text-sm text-gray-700">Items ({cart.length})</p>
        </div>
        <div className="divide-y divide-gray-50">
          {cart.map((item, i) => (
            <div key={i} className="px-4 py-3 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">{item.product.name}</p>
                <p className="text-xs text-gray-500">{item.variant.name} {item.variant.sku ? `· ${item.variant.sku}` : ''}</p>
                {item.product.is_serialized && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {item.serials.map((s, si) => (
                      <span key={si} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-mono rounded">
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(item.quantity * item.unit_cost)}</p>
                <p className="text-xs text-gray-400">{item.quantity} × {formatCurrency(item.unit_cost)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between">
          <span className="text-sm text-gray-500">{totalSerials} serial number{totalSerials !== 1 ? 's' : ''} to register</span>
          <span className="font-bold text-gray-900">{formatCurrency(totalAmount)}</span>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button type="button" className="btn-secondary flex items-center gap-2" onClick={onBack} disabled={submitting}>
          <ChevronLeft size={16} /> Back
        </button>
        <button
          type="button"
          className="btn-primary flex items-center gap-2 px-6"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          Confirm & Receive Stock
        </button>
      </div>
    </div>
  )
}

// ─── Main Wizard Component ────────────────────────────────────────────────────

export default function ReceiveStockPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([])

  // Wizard state
  const [details, setDetails] = useState<DetailForm>({
    supplier_id: null,
    invoice_number: '',
    purchase_date: new Date().toISOString().split('T')[0],
    paid_amount: 0,
    notes: '',
  })
  const [cart, setCart] = useState<CartItem[]>([])

  useEffect(() => {
    supplierService.list({ per_page: 200 }).then(r => setSuppliers(r.items))
  }, [])

  const handleAddItem = (item: CartItem) => {
    setCart(prev => [...prev, item])
    toast.success(`Added: ${item.product.name} — ${item.variant.name}`)
  }

  const handleRemoveItem = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx))

  const handleUpdateSerials = (idx: number, serials: string[]) => {
    setCart(prev => prev.map((item, i) => i === idx ? { ...item, serials } : item))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const items: PurchaseItemCreate[] = cart.map(item => ({
        variant_id: item.variant.id,
        quantity:   item.quantity,
        unit_cost:  item.unit_cost,
        serials:    item.serials.map(s => ({ serial: s })),
      }))

      const payload = {
        supplier_id:    details.supplier_id || null,
        invoice_number: details.invoice_number || undefined,
        purchase_date:  details.purchase_date,
        paid_amount:    details.paid_amount,
        notes:          details.notes || undefined,
        items,
      }

      const purchase = await purchaseService.create(payload)
      toast.success(`Stock received! ${purchase.purchase_number}`)
      navigate(`/purchases/${purchase.id}`)
    } catch {
      // error shown by interceptor
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl">
      {/* Back link */}
      <button
        onClick={() => navigate('/purchases')}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ChevronLeft size={16} /> Back to Purchases
      </button>

      <h2 className="text-xl font-bold text-gray-900 mb-5">Receive Stock</h2>

      <StepBar current={step} />

      {step === 0 && (
        <StepDetails
          suppliers={suppliers}
          defaultValues={details}
          onNext={d => { setDetails(d); setStep(1) }}
        />
      )}

      {step === 1 && (
        <StepProducts
          cart={cart}
          onAddItem={handleAddItem}
          onRemoveItem={handleRemoveItem}
          onBack={() => setStep(0)}
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <StepSerials
          cart={cart}
          onUpdateSerials={handleUpdateSerials}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <StepConfirm
          details={details}
          cart={cart}
          suppliers={suppliers}
          onBack={() => setStep(2)}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      )}
    </div>
  )
}
