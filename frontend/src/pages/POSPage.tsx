/**
 * POS / New Sale page — Phase 8.
 *
 * 4-step wizard:
 *   Step 1 — Customer + sale details (date, payment, discount, loyalty)
 *   Step 2 — Build cart (add products/variants, set quantities & prices)
 *   Step 3 — Enter serials for serialized items
 *   Step 4 — Review & confirm
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ChevronRight, ChevronLeft, Check, Plus, Trash2,
  Loader2, Users, Package, Tag, ClipboardList, Star,
  ScanLine,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import BarcodeScanner from '@/components/scanner/BarcodeScanner'
import { customerService, type CustomerListItem } from '@/services/customerService'
import { productService, type Product, type ProductVariant } from '@/services/productService'
import { saleService, type SaleItemCreate } from '@/services/saleService'
import { formatCurrency } from '@/utils/format'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CartItem {
  variant:   ProductVariant
  product:   Product
  quantity:  number
  unit_price: number   // frozen from variant.selling_price, editable
  discount:  number
  serials:   string[]
}

// ─── Step bar ─────────────────────────────────────────────────────────────────

const STEPS = [
  { label: 'Customer',  icon: Users },
  { label: 'Products',  icon: Package },
  { label: 'Serials',   icon: Tag },
  { label: 'Confirm',   icon: ClipboardList },
]

function StepBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 mb-6">
      {STEPS.map((s, i) => (
        <div key={i} className="flex items-center flex-1 last:flex-none">
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors
            ${i === current ? 'bg-primary-600 text-white' :
              i < current  ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-400'}`}>
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

// ─── Step 1: Customer + Details ───────────────────────────────────────────────

const detailSchema = z.object({
  customer_id:             z.coerce.number().optional().nullable(),
  sale_date:               z.string().min(1, 'Date is required'),
  paid_amount:             z.coerce.number().min(0).default(0),
  discount_amount:         z.coerce.number().min(0).default(0),
  loyalty_points_redeemed: z.coerce.number().min(0).default(0),
  notes:                   z.string().optional(),
})
type DetailForm = z.infer<typeof detailSchema>

function StepCustomer({
  customers, defaultValues, onNext,
}: { customers: CustomerListItem[]; defaultValues: DetailForm; onNext: (d: DetailForm) => void }) {
  const form = useForm<DetailForm>({ resolver: zodResolver(detailSchema), defaultValues })
  const selectedId = form.watch('customer_id')
  const selectedCustomer = customers.find(c => c.id === Number(selectedId))

  return (
    <form onSubmit={form.handleSubmit(onNext)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="label">Customer</label>
          <select className="input" {...form.register('customer_id')}>
            <option value="">— Walk-in / No customer —</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name}{c.phone ? ` (${c.phone})` : ''} — {c.loyalty_points} pts
              </option>
            ))}
          </select>
          {selectedCustomer && (
            <p className="mt-1.5 text-xs text-primary-600 flex items-center gap-1">
              <Star size={11} className="text-yellow-400" />
              {selectedCustomer.loyalty_points} loyalty points available
            </p>
          )}
        </div>

        <div>
          <label className="label">Sale Date *</label>
          <input type="date" className="input" {...form.register('sale_date')} />
          {form.formState.errors.sale_date && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.sale_date.message}</p>
          )}
        </div>

        <div>
          <label className="label">Amount Paid (৳)</label>
          <input type="number" step="0.01" className="input" placeholder="0" {...form.register('paid_amount')} />
        </div>

        <div>
          <label className="label">Discount (৳)</label>
          <input type="number" step="0.01" className="input" placeholder="0" {...form.register('discount_amount')} />
        </div>

        <div>
          <label className="label">Loyalty Points to Redeem</label>
          <input
            type="number" className="input" placeholder="0"
            {...form.register('loyalty_points_redeemed')}
            max={selectedCustomer?.loyalty_points ?? 0}
            disabled={!selectedCustomer}
          />
          {selectedCustomer && (
            <p className="mt-0.5 text-xs text-gray-400">
              100 pts = ৳10 off
            </p>
          )}
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

// ─── Step 2: Cart ─────────────────────────────────────────────────────────────

function StepCart({
  cart, onUpdateCart, onBack, onNext,
}: {
  cart: CartItem[]
  onUpdateCart: (cart: CartItem[]) => void
  onBack: () => void
  onNext: () => void
}) {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [qty, setQty] = useState(1)
  const [showScanModal, setShowScanModal] = useState(false)

  useEffect(() => {
    productService.list({ per_page: 200, is_active: true })
      .then(r => setProducts(r.items as unknown as Product[]))
      .catch(() => toast.error('Failed to load products'))
  }, [])

  const handleBarcodeScan = async (barcode: string) => {
    try {
      const res = await productService.scan({ barcode })
      if (!res) {
        toast.error(`Barcode ${barcode} not found`)
        return
      }
      let p = products.find(prod => prod.id === res.product_id)
      if (!p) {
        p = await productService.get(res.product_id)
      }
      const v = p?.variants?.find(varnt => varnt.id === res.variant_id)
      if (!v || !p) {
        toast.error('Product variant not found')
        return
      }
      if (v.current_stock <= 0) {
        toast.error(`${p.name} (${v.name}) is out of stock!`)
        return
      }

      const existing = cart.findIndex(i => i.variant.id === v.id)
      if (existing >= 0) {
        const updated = [...cart]
        updated[existing].quantity += 1
        onUpdateCart(updated)
      } else {
        onUpdateCart([...cart, {
          variant: v,
          product: p,
          quantity: 1,
          unit_price: Number(v.selling_price),
          discount: 0,
          serials: [],
        }])
      }
      toast.success(`Scanned & added: ${p.name} (${v.name})`)
    } catch {
      toast.error(`Barcode "${barcode}" not found`)
    }
  }

  const addToCart = () => {
    if (!selectedVariant || !selectedProduct) return
    // Check if variant already in cart
    const existing = cart.findIndex(i => i.variant.id === selectedVariant.id)
    if (existing >= 0) {
      const updated = [...cart]
      updated[existing].quantity += qty
      onUpdateCart(updated)
    } else {
      onUpdateCart([...cart, {
        variant:    selectedVariant,
        product:    selectedProduct,
        quantity:   qty,
        unit_price: Number(selectedVariant.selling_price),
        discount:   0,
        serials:    [],
      }])
    }
    setSelectedProduct(null)
    setSelectedVariant(null)
    setQty(1)
  }

  const removeItem = (idx: number) => {
    onUpdateCart(cart.filter((_, i) => i !== idx))
  }

  const updateQty = (idx: number, q: number) => {
    if (q < 1) return
    const updated = [...cart]
    updated[idx].quantity = q
    updated[idx].serials = []   // reset serials when qty changes
    onUpdateCart(updated)
  }

  const updatePrice = (idx: number, price: number) => {
    const updated = [...cart]
    updated[idx].unit_price = price
    onUpdateCart(updated)
  }

  const total = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0)

  return (
    <div className="space-y-5">
      {/* Add item */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-700 text-sm">Add Item</p>
          <button
            type="button"
            onClick={() => setShowScanModal(true)}
            className="px-3 py-1.5 rounded-lg border border-primary-200 bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <ScanLine size={14} /> Scan Barcode (Camera / iVCam)
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="label">Product</label>
            <select
              className="input"
              value={selectedProduct?.id ?? ''}
              onChange={e => {
                const p = products.find(x => x.id === Number(e.target.value)) ?? null
                setSelectedProduct(p)
                setSelectedVariant(null)
              }}
            >
              <option value="">— Select Product —</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.brand_name ? `${p.brand_name} — ` : ''}{p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Variant</label>
            <select
              className="input"
              disabled={!selectedProduct}
              value={selectedVariant?.id ?? ''}
              onChange={e => {
                const v = selectedProduct?.variants?.find(x => x.id === Number(e.target.value)) ?? null
                setSelectedVariant(v)
              }}
            >
              <option value="">— Select Variant —</option>
              {selectedProduct?.variants?.filter(v => v.is_active).map(v => (
                <option key={v.id} value={v.id} disabled={v.current_stock === 0}>
                  {v.name} — {v.current_stock} in stock — {formatCurrency(v.selling_price)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Qty</label>
            <input
              type="number" min={1} className="input" value={qty}
              onChange={e => setQty(Math.max(1, Number(e.target.value)))}
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              className="btn-primary w-full flex items-center justify-center gap-2"
              disabled={!selectedVariant}
              onClick={addToCart}
            >
              <Plus size={15} /> Add
            </button>
          </div>
        </div>
      </div>

      {/* Cart table */}
      {cart.length === 0 ? (
        <div className="card text-center py-10 text-gray-400">
          <Package size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">No items yet — add products above</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Product</th>
                <th className="text-center px-3 py-3 font-medium text-gray-600 w-20">Qty</th>
                <th className="text-right px-3 py-3 font-medium text-gray-600 w-32">Price (৳)</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 w-28">Total</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {cart.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{item.product.name}</p>
                    <p className="text-xs text-gray-400">{item.variant.name} {item.variant.sku ? `· ${item.variant.sku}` : ''}</p>
                    {item.product.is_serialized && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">Serialized</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number" min={1}
                      max={item.product.is_serialized ? undefined : item.variant.current_stock}
                      className="input text-center py-1 text-sm w-20"
                      value={item.quantity}
                      onChange={e => updateQty(idx, Number(e.target.value))}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <input
                      type="number" step="0.01"
                      className="input text-right py-1 text-sm w-32"
                      value={item.unit_price}
                      onChange={e => updatePrice(idx, Number(e.target.value))}
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {formatCurrency(item.quantity * item.unit_price)}
                  </td>
                  <td className="px-2">
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">
                  Subtotal
                </td>
                <td className="px-4 py-3 text-right font-bold text-gray-900">
                  {formatCurrency(total)}
                </td>
                <td />
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
          Next: Serials <ChevronRight size={16} />
        </button>
      </div>

      {/* Barcode Scanner Modal for POS */}
      <Modal
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
        title="Scan Barcode into Cart (Webcam / Phone iVCam)"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Hold a product barcode in front of your camera or phone (via iVCam) to automatically add it to the cart.
          </p>
          <BarcodeScanner onScan={handleBarcodeScan} />
          <div className="flex justify-end pt-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => setShowScanModal(false)}
            >
              Done Scanning
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ─── Step 3: Serials ──────────────────────────────────────────────────────────

function StepSerials({
  cart, onUpdateSerials, onBack, onNext,
}: {
  cart: CartItem[]
  onUpdateSerials: (idx: number, serials: string[]) => void
  onBack: () => void
  onNext: () => void
}) {
  const serializedItems = cart.filter(i => i.product.is_serialized)

  const handleChange = (cartIdx: number, si: number, value: string) => {
    const realIdx = cart.indexOf(serializedItems[cartIdx])
    const updated = [...cart[realIdx].serials]
    updated[si] = value.trim().toUpperCase()
    onUpdateSerials(realIdx, updated)
  }

  useEffect(() => {
    cart.forEach((item, idx) => {
      if (item.product.is_serialized && item.serials.length !== item.quantity) {
        onUpdateSerials(idx, Array(item.quantity).fill(''))
      }
    })
  }, [])

  const allFilled = serializedItems.every(
    item => item.serials.length === item.quantity && item.serials.every(s => s.trim().length > 0)
  )

  return (
    <div className="space-y-5">
      {serializedItems.length === 0 ? (
        <div className="card text-center py-8">
          <Check size={32} className="text-green-500 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No serial numbers needed</p>
          <p className="text-sm text-gray-400 mt-1">All items in this sale are non-serialized.</p>
        </div>
      ) : (
        serializedItems.map((item, cartIdx) => {
          const realIdx = cart.indexOf(item)
          return (
            <div key={cartIdx} className="card space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 flex-shrink-0">
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
                      onChange={e => handleChange(cartIdx, si, e.target.value)}
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
  details, cart, customers, onBack, onSubmit, submitting,
}: {
  details: DetailForm
  cart: CartItem[]
  customers: CustomerListItem[]
  onBack: () => void
  onSubmit: () => void
  submitting: boolean
}) {
  const customer = customers.find(c => c.id === Number(details.customer_id))
  const subtotal  = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const discount  = Number(details.discount_amount) || 0
  const loyaltyValue = (Number(details.loyalty_points_redeemed) || 0) * 0.10
  const netPayable = Math.max(0, subtotal - discount - loyaltyValue)
  const totalSerials = cart.filter(i => i.product.is_serialized).reduce((s, i) => s + i.serials.length, 0)

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Customer',  value: customer?.name ?? 'Walk-in' },
          { label: 'Date',      value: details.sale_date },
          { label: 'Subtotal',  value: formatCurrency(subtotal) },
          { label: 'Net Total', value: formatCurrency(netPayable) },
        ].map(s => (
          <div key={s.label} className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-0.5">{s.label}</p>
            <p className="font-semibold text-gray-900 text-sm">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Deductions */}
      {(discount > 0 || loyaltyValue > 0) && (
        <div className="card bg-green-50 border-green-200 space-y-1">
          {discount > 0 && (
            <p className="text-sm text-green-700">Discount: −{formatCurrency(discount)}</p>
          )}
          {loyaltyValue > 0 && (
            <p className="text-sm text-green-700">
              Loyalty redemption ({details.loyalty_points_redeemed} pts): −{formatCurrency(loyaltyValue)}
            </p>
          )}
        </div>
      )}

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
                <p className="text-xs text-gray-500">{item.variant.name}{item.variant.sku ? ` · ${item.variant.sku}` : ''}</p>
                {item.product.is_serialized && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {item.serials.map((s, si) => (
                      <span key={si} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-mono rounded">{s}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(item.quantity * item.unit_price)}</p>
                <p className="text-xs text-gray-400">{item.quantity} × {formatCurrency(item.unit_price)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
          <span className="text-sm text-gray-500">{totalSerials} serial number{totalSerials !== 1 ? 's' : ''} to register</span>
          <span className="font-bold text-gray-900">{formatCurrency(netPayable)}</span>
        </div>
      </div>

      {/* Payment info */}
      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        <div className="bg-blue-50 rounded-xl p-3">
          <p className="text-xs text-gray-500">Net Payable</p>
          <p className="font-bold text-blue-700">{formatCurrency(netPayable)}</p>
        </div>
        <div className="bg-green-50 rounded-xl p-3">
          <p className="text-xs text-gray-500">Paid</p>
          <p className="font-bold text-green-700">{formatCurrency(details.paid_amount)}</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-3">
          <p className="text-xs text-gray-500">Due</p>
          <p className="font-bold text-orange-700">{formatCurrency(Math.max(0, netPayable - Number(details.paid_amount)))}</p>
        </div>
      </div>

      <div className="flex justify-between pt-2">
        <button type="button" className="btn-secondary flex items-center gap-2" onClick={onBack}>
          <ChevronLeft size={16} /> Back
        </button>
        <button
          type="button"
          className="btn-primary flex items-center gap-2 min-w-[140px] justify-center"
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          {submitting ? 'Processing…' : 'Confirm Sale'}
        </button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function POSPage() {
  const navigate  = useNavigate()
  const today     = new Date().toISOString().slice(0, 10)

  const [step, setStep]       = useState(0)
  const [customers, setCustomers] = useState<CustomerListItem[]>([])
  const [details, setDetails] = useState<DetailForm>({
    customer_id: null, sale_date: today,
    paid_amount: 0, discount_amount: 0,
    loyalty_points_redeemed: 0, notes: '',
  })
  const [cart, setCart]       = useState<CartItem[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    customerService.list({ per_page: 200 }).then(r => setCustomers(r.items))
  }, [])

  const updateSerials = (idx: number, serials: string[]) => {
    setCart(prev => { const c = [...prev]; c[idx] = { ...c[idx], serials }; return c })
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const items: SaleItemCreate[] = cart.map(item => ({
        variant_id: item.variant.id,
        quantity:   item.quantity,
        unit_price: item.unit_price,
        discount_amount: item.discount,
        serials:    item.serials.map(s => ({ serial: s })),
      }))

      const sale = await saleService.create({
        customer_id:             details.customer_id ?? undefined,
        sale_date:               details.sale_date,
        paid_amount:             Number(details.paid_amount),
        discount_amount:         Number(details.discount_amount),
        loyalty_points_redeemed: Number(details.loyalty_points_redeemed),
        notes:                   details.notes || undefined,
        items,
      })

      toast.success(`Sale ${sale.sale_number} completed!`)
      navigate(`/sales/${sale.id}`)
    } catch { /* interceptor */ }
    finally { setSubmitting(false) }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-2">
      <div>
        <h2 className="text-xl font-bold text-gray-900">New Sale</h2>
        <p className="text-sm text-gray-500 mt-0.5">Point of sale — create a new transaction</p>
      </div>

      <div className="card">
        <StepBar current={step} />

        {step === 0 && (
          <StepCustomer
            customers={customers}
            defaultValues={details}
            onNext={d => { setDetails(d); setStep(1) }}
          />
        )}
        {step === 1 && (
          <StepCart
            cart={cart}
            onUpdateCart={setCart}
            onBack={() => setStep(0)}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <StepSerials
            cart={cart}
            onUpdateSerials={updateSerials}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <StepConfirm
            details={details}
            cart={cart}
            customers={customers}
            onBack={() => setStep(2)}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  )
}
