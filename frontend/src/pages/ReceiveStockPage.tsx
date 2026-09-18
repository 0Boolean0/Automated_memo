/**
 * Receive Stock Wizard — 4 steps:
 *   Step 1: Supplier + purchase details (date, invoice number, payment)
 *   Step 2: Add products/variants + quantities + costs
 *   Step 3: Enter serial numbers (for serialized products)
 *   Step 4: Review & confirm
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ChevronRight, ChevronLeft, Check, Plus, Trash2,
  Loader2, Truck, Package, Tag, ClipboardList,
  Search, X, UserPlus, Building,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supplierService, type SupplierListItem } from '@/services/supplierService'
import { productService, type Product, type ProductVariant } from '@/services/productService'
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
  suppliers, defaultValues, onNext, onSupplierCreated,
}: {
  suppliers: SupplierListItem[]
  defaultValues: DetailForm
  onNext: (d: DetailForm) => void
  onSupplierCreated: (s: SupplierListItem) => void
}) {
  const form = useForm<DetailForm>({ resolver: zodResolver(detailSchema), defaultValues })
  const selectedSupplierId = form.watch('supplier_id')

  const [vendorSearch, setVendorSearch] = useState('')
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [creatingVendor, setCreatingVendor] = useState(false)
  const [showQuickModal, setShowQuickModal] = useState(false)
  const [quickForm, setQuickForm] = useState({ name: '', company: '', phone: '', email: '', address: '' })

  const dropdownRef = useRef<HTMLDivElement>(null)

  // Find currently selected supplier object
  const currentSupplier = useMemo(() => {
    if (!selectedSupplierId) return null
    return suppliers.find(s => s.id === Number(selectedSupplierId)) ?? null
  }, [suppliers, selectedSupplierId])

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter suppliers by typed query
  const filteredSuppliers = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter(s =>
      s.name.toLowerCase().includes(q) ||
      (s.company && s.company.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q))
    )
  }, [suppliers, vendorSearch])

  // Exact match check
  const hasExactMatch = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase()
    if (!q) return false
    return suppliers.some(s => s.name.trim().toLowerCase() === q)
  }, [suppliers, vendorSearch])

  // Quick inline creation for typed name
  const handleQuickCreate = async (nameToCreate?: string) => {
    const name = (nameToCreate || vendorSearch).trim()
    if (!name) return
    setCreatingVendor(true)
    try {
      const created = await supplierService.create({ name })
      toast.success(`Supplier "${created.name}" created!`)
      onSupplierCreated(created)
      form.setValue('supplier_id', created.id)
      setVendorSearch('')
      setIsDropdownOpen(false)
    } catch {
      toast.error('Failed to create supplier')
    } finally {
      setCreatingVendor(false)
    }
  }

  // Quick Modal creation with extra fields
  const handleModalCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickForm.name.trim()) {
      toast.error('Supplier name is required')
      return
    }
    setCreatingVendor(true)
    try {
      const created = await supplierService.create({
        name: quickForm.name.trim(),
        company: quickForm.company.trim() || undefined,
        phone: quickForm.phone.trim() || undefined,
        email: quickForm.email.trim() || undefined,
        address: quickForm.address.trim() || undefined,
      })
      toast.success(`Supplier "${created.name}" created!`)
      onSupplierCreated(created)
      form.setValue('supplier_id', created.id)
      setShowQuickModal(false)
      setQuickForm({ name: '', company: '', phone: '', email: '', address: '' })
      setVendorSearch('')
      setIsDropdownOpen(false)
    } catch {
      toast.error('Failed to create supplier')
    } finally {
      setCreatingVendor(false)
    }
  }

  const handleSelectSupplier = (id: number | null) => {
    form.setValue('supplier_id', id)
    setIsDropdownOpen(false)
    setVendorSearch('')
  }

  return (
    <>
      <form onSubmit={form.handleSubmit(onNext)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {/* Supplier / Vendor Searchable Field */}
          <div className="col-span-2" ref={dropdownRef}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="label mb-0">Supplier / Vendor / Distributor</label>
              <button
                type="button"
                onClick={() => {
                  setQuickForm(prev => ({ ...prev, name: vendorSearch }))
                  setShowQuickModal(true)
                }}
                className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                <UserPlus size={13} /> + New Vendor
              </button>
            </div>

            {currentSupplier ? (
              /* Selected supplier pill display */
              <div className="flex items-center justify-between p-2.5 bg-blue-50/60 border border-primary-200 rounded-lg">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-md bg-primary-100 text-primary-700 flex items-center justify-center flex-shrink-0">
                    <Building size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {currentSupplier.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {currentSupplier.company ? `Company: ${currentSupplier.company}` : 'Registered Supplier'}
                      {currentSupplier.phone ? ` · ${currentSupplier.phone}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsDropdownOpen(true)
                    }}
                    className="text-xs text-primary-600 hover:text-primary-800 font-medium px-2 py-1 rounded hover:bg-primary-100/50"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectSupplier(null)}
                    className="text-gray-400 hover:text-red-600 p-1 rounded-md"
                    title="Remove supplier (set to Walk-in)"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ) : (
              /* Search / Type input when no supplier selected */
              <div className="relative">
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    className="input pl-9 pr-8"
                    placeholder="Type vendor or distributor name to search or add…"
                    value={vendorSearch}
                    onChange={e => {
                      setVendorSearch(e.target.value)
                      setIsDropdownOpen(true)
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                  />
                  {vendorSearch && (
                    <button
                      type="button"
                      onClick={() => setVendorSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Dropdown menu */}
                {isDropdownOpen && (
                  <div className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-60 flex flex-col">
                    <div className="overflow-y-auto flex-1 divide-y divide-gray-50">
                      {/* Walk-in Option */}
                      <button
                        type="button"
                        onClick={() => handleSelectSupplier(null)}
                        className="w-full text-left px-3 py-2.5 hover:bg-gray-50 text-sm text-gray-700 flex items-center justify-between"
                      >
                        <span className="text-gray-500 font-medium">— Walk-in / Unknown —</span>
                        <span className="text-xs text-gray-400">No linked supplier</span>
                      </button>

                      {/* Matching suppliers */}
                      {filteredSuppliers.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => handleSelectSupplier(s.id)}
                          className="w-full text-left px-3 py-2.5 hover:bg-primary-50 transition-colors text-sm flex items-center justify-between group"
                        >
                          <div>
                            <p className="font-medium text-gray-900 group-hover:text-primary-700">{s.name}</p>
                            {s.company && <p className="text-xs text-gray-500">{s.company}</p>}
                          </div>
                          {s.phone && <span className="text-xs text-gray-400">{s.phone}</span>}
                        </button>
                      ))}

                      {filteredSuppliers.length === 0 && (
                        <div className="px-3 py-2.5 text-center text-xs text-gray-400">
                          No existing supplier matches "{vendorSearch}"
                        </div>
                      )}
                    </div>

                    {/* Quick Create typed vendor option */}
                    {vendorSearch.trim().length > 0 && !hasExactMatch && (
                      <div className="p-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-600 truncate">
                          Not found: <strong>{vendorSearch.trim()}</strong>
                        </span>
                        <button
                          type="button"
                          disabled={creatingVendor}
                          onClick={() => handleQuickCreate()}
                          className="btn-primary text-xs py-1 px-2.5 flex items-center gap-1 flex-shrink-0"
                        >
                          {creatingVendor ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                          Add "{vendorSearch.trim()}"
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
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

      {/* Quick Add Vendor Modal */}
      {showQuickModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <Building size={18} className="text-primary-600" /> Add New Supplier / Vendor
              </h3>
              <button
                type="button"
                onClick={() => setShowQuickModal(false)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleModalCreate} className="space-y-3 text-sm">
              <div>
                <label className="label">Vendor / Supplier Name *</label>
                <input
                  type="text"
                  required
                  className="input"
                  placeholder="e.g. Acme Tech Distributors"
                  value={quickForm.name}
                  onChange={e => setQuickForm({ ...quickForm, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Company Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Acme Corp"
                  value={quickForm.company}
                  onChange={e => setQuickForm({ ...quickForm, company: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Phone</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="017..."
                    value={quickForm.phone}
                    onChange={e => setQuickForm({ ...quickForm, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="vendor@mail.com"
                    value={quickForm.email}
                    onChange={e => setQuickForm({ ...quickForm, email: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label">Address</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Vendor address..."
                  value={quickForm.address}
                  onChange={e => setQuickForm({ ...quickForm, address: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowQuickModal(false)}
                  disabled={creatingVendor}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex items-center gap-1.5"
                  disabled={creatingVendor}
                >
                  {creatingVendor ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  Save & Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
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
  const [products, setProducts]                 = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct]   = useState<Product | null>(null)
  const [selectedVariant, setSelectedVariant]   = useState<ProductVariant | null>(null)
  const [quantity, setQuantity]                 = useState(1)
  const [unitCost, setUnitCost]                 = useState(0)
  const [loadingProducts, setLoadingProducts]   = useState(true)
  const [productSearch, setProductSearch]       = useState('')
  const [loadingVariant, setLoadingVariant]     = useState(false)

  useEffect(() => {
    setLoadingProducts(true)
    productService.list({ per_page: 200 })
      .then(r => {
        setProducts(r.items as unknown as Product[])
      })
      .catch(() => {
        toast.error('Failed to load products')
      })
      .finally(() => {
        setLoadingProducts(false)
      })
  }, [])

  // Filter products by typed search (name, brand, or category)
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase()
    if (!q) return products
    return products.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.brand_name && p.brand_name.toLowerCase().includes(q)) ||
      (p.category_name && p.category_name.toLowerCase().includes(q))
    )
  }, [products, productSearch])

  // Handle product selection
  const handleProductChange = async (productIdStr: string) => {
    const id = Number(productIdStr)
    if (!id) {
      setSelectedProduct(null)
      setSelectedVariant(null)
      setUnitCost(0)
      return
    }

    const p = products.find(x => x.id === id) ?? null
    if (!p) return

    setSelectedProduct(p)
    setSelectedVariant(null)
    setUnitCost(0)

    // Check if variants exist on p
    let variants = p.variants || []
    if (!variants || variants.length === 0) {
      // Fallback: fetch full product details with variants
      setLoadingVariant(true)
      try {
        const full = await productService.get(p.id)
        variants = full.variants || []
        p.variants = variants
        setSelectedProduct({ ...p, variants })
      } catch {
        toast.error('Failed to fetch product variants')
      } finally {
        setLoadingVariant(false)
      }
    }

    // If product has exactly 1 active variant, auto-select it!
    const activeVariants = variants.filter(v => v.is_active)
    if (activeVariants.length === 1) {
      const v = activeVariants[0]
      setSelectedVariant(v)
      setUnitCost(Number(v.cost_price) || 0)
    }
  }

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
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Add Product to Receiving List</p>
          {products.length > 5 && (
            <div className="relative w-64">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                className="input text-xs py-1.5 pl-8 pr-7"
                placeholder="Filter by brand or name…"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
              />
              {productSearch && (
                <button
                  type="button"
                  onClick={() => setProductSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2">
            <label className="label">Product (Brand — Name)</label>
            <select
              className="input"
              value={selectedProduct?.id ?? ''}
              disabled={loadingProducts}
              onChange={e => handleProductChange(e.target.value)}
            >
              <option value="">
                {loadingProducts ? '— Loading Products… —' : '— Select Product —'}
              </option>
              {loadingProducts ? (
                <option disabled>Loading…</option>
              ) : (
                filteredProducts.map(p => {
                  const brandText = p.brand_name ? `${p.brand_name} — ` : ''
                  return (
                    <option key={p.id} value={p.id}>
                      {brandText}{p.name}
                    </option>
                  )
                })
              )}
            </select>
          </div>

          <div className="col-span-2">
            <label className="label">Variant</label>
            <select
              className="input"
              value={selectedVariant?.id ?? ''}
              disabled={!selectedProduct || loadingVariant}
              onChange={e => {
                const v = selectedProduct?.variants?.find(x => x.id === Number(e.target.value)) ?? null
                setSelectedVariant(v)
                if (v) setUnitCost(Number(v.cost_price) || 0)
              }}
            >
              <option value="">
                {loadingVariant
                  ? 'Loading variants…'
                  : !selectedProduct
                  ? '— Select Product First —'
                  : '— Select Variant —'}
              </option>
              {selectedProduct?.variants?.filter(v => v.is_active).map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.sku ? `(${v.sku})` : ''} — Cost: {formatCurrency(v.cost_price)}
                </option>
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
                    <p className="font-medium text-gray-900">
                      {item.product.brand_name ? `${item.product.brand_name} — ` : ''}{item.product.name}
                    </p>
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
                  <p className="font-semibold text-gray-900">
                    {item.product.brand_name ? `${item.product.brand_name} — ` : ''}{item.product.name}
                  </p>
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
                <p className="font-medium text-gray-900 text-sm">
                  {item.product.brand_name ? `${item.product.brand_name} — ` : ''}{item.product.name}
                </p>
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
    supplierService.list({ per_page: 200 })
      .then(r => setSuppliers(r.items))
      .catch(() => toast.error('Failed to load suppliers'))
  }, [])

  const handleSupplierCreated = (newSupplier: SupplierListItem) => {
    setSuppliers(prev => [newSupplier, ...prev])
  }

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
          onSupplierCreated={handleSupplierCreated}
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
