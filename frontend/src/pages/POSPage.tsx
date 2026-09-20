/**
 * POS / New Sale page — Phase 8.
 *
 * 4-step wizard:
 *   Step 1 — Customer + sale details (date, payment, discount, loyalty)
 *   Step 2 — Build cart (add products/variants, set quantities & prices)
 *   Step 3 — Enter serials for serialized items
 *   Step 4 — Review & confirm
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  ChevronRight, ChevronLeft, Check, Plus, Trash2,
  Loader2, Users, Package, Tag, ClipboardList, Star,
  ScanLine, Printer, Download, Sparkles, Shield,
  Search, Camera, Upload, Hash, CheckCircle2, AlertCircle,
  X, ChevronDown, ChevronUp, Layers, Image as ImageIcon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { BrowserMultiFormatReader } from '@zxing/browser'
import api from '@/services/api'
import Modal from '@/components/ui/Modal'
import BarcodeScanner from '@/components/scanner/BarcodeScanner'
import { customerService, type CustomerListItem } from '@/services/customerService'
import {
  productService,
  type Product,
  type ProductVariant,
  type InStockProductItem,
  type InStockVariantItem,
  type QuickLookupResult,
  type ScanImageResponse,
} from '@/services/productService'
import { saleService, type SaleItemCreate, type Sale } from '@/services/saleService'
import { formatCurrency } from '@/utils/format'

// ─── Types & Presets ──────────────────────────────────────────────────────────

export const WARRANTY_PRESETS = [
  { label: 'No Warranty',         period: 'No Warranty',         months: 0 },
  { label: '7 Days Replacement',  period: '7 Days Replacement',  months: 0 },
  { label: '10 Days Replacement', period: '10 Days Replacement', months: 0 },
  { label: '1 Month',             period: '1 Month',             months: 1 },
  { label: '3 Months',            period: '3 Months',            months: 3 },
  { label: '6 Months',            period: '6 Months',            months: 6 },
  { label: '1 Year',              period: '1 Year',              months: 12 },
  { label: '2 Years',             period: '2 Years',             months: 24 },
  { label: '3 Years',             period: '3 Years',             months: 36 },
  { label: '5 Years',             period: '5 Years',             months: 60 },
  { label: 'Lifetime',            period: 'Lifetime',            months: 999 },
]

export function formatDefaultWarranty(months?: number): { period: string; months: number } {
  const m = months ?? 0
  if (m <= 0) return { period: 'No Warranty', months: 0 }
  if (m % 12 === 0) {
    const y = m / 12
    return { period: y === 1 ? '1 Year' : `${y} Years`, months: m }
  }
  return { period: `${m} Months`, months: m }
}

interface CartItem {
  variant:         ProductVariant
  product:         Product
  quantity:        number
  unit_price:      number   // frozen from variant.selling_price, editable
  discount:        number
  warranty_period: string   // e.g. "1 Year", "2 Years", "7 Days", "No Warranty"
  warranty_months: number   // e.g. 12, 24, 0
  serials:         string[]
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

// ─── Photo / Picture Scan Modal ────────────────────────────────────────────────

function PhotoScanModal({
  isOpen,
  onClose,
  onAddMatch,
}: {
  isOpen: boolean
  onClose: () => void
  onAddMatch: (match: QuickLookupResult) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [scanResult, setScanResult] = useState<ScanImageResponse | null>(null)
  const [manualCode, setManualCode] = useState('')
  const [manualLoading, setManualLoading] = useState(false)

  const resetState = () => {
    setImageFile(null)
    if (imagePreview) URL.revokeObjectURL(imagePreview)
    setImagePreview(null)
    setAnalyzing(false)
    setScanResult(null)
    setManualCode('')
    setManualLoading(false)
  }

  const handleClose = () => {
    resetState()
    onClose()
  }

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (JPEG, PNG, etc.)')
      return
    }
    setImageFile(file)
    const previewUrl = URL.createObjectURL(file)
    setImagePreview(previewUrl)
    setAnalyzing(true)
    setScanResult(null)

    let barcodeDetected: string | null = null

    // 1. Try client-side ZXing barcode decode first
    try {
      const reader = new BrowserMultiFormatReader()
      const zxRes = await reader.decodeFromImageUrl(previewUrl)
      if (zxRes && zxRes.getText()) {
        barcodeDetected = zxRes.getText()
      }
    } catch {
      // No barcode found by ZXing — continue to backend OCR
    }

    if (barcodeDetected) {
      try {
        const matches = await productService.quickLookup(barcodeDetected)
        if (matches && matches.length > 0) {
          setScanResult({
            found: true,
            raw_text: barcodeDetected,
            detected_code: barcodeDetected,
            match: matches[0],
            message: `Detected barcode from image: ${barcodeDetected}`,
          })
          setAnalyzing(false)
          return
        }
      } catch {
        // Continue to backend OCR
      }
    }

    // 2. Call backend OCR (Windows native OCR)
    try {
      const ocrRes = await productService.scanImage(file)
      setScanResult(ocrRes)
    } catch {
      setScanResult({
        found: false,
        raw_text: '',
        detected_code: barcodeDetected,
        match: null,
        message: 'Could not detect code. You can enter or edit the code manually below.',
      })
    } finally {
      setAnalyzing(false)
    }
  }

  const handleManualSearch = async () => {
    const q = manualCode.trim()
    if (!q) return
    setManualLoading(true)
    try {
      const matches = await productService.quickLookup(q)
      if (matches && matches.length > 0) {
        setScanResult({
          found: true,
          raw_text: q,
          detected_code: q,
          match: matches[0],
          message: `Found match for: ${q}`,
        })
      } else {
        toast.error(`No in-stock product or serial found for "${q}"`)
      }
    } catch {
      toast.error(`Lookup failed for "${q}"`)
    } finally {
      setManualLoading(false)
    }
  }

  // Handle Ctrl+V paste while modal is open
  useEffect(() => {
    if (!isOpen) return
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            processFile(file)
            break
          }
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [isOpen])

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Photo / Picture Scan (Barcode or Serial Sticker)"
      maxWidth="lg"
    >
      <div className="space-y-4">
        <p className="text-xs text-gray-500">
          Take a picture or upload an image of a serial number sticker, barcode, or product label.
          The system will automatically recognize the barcode or OCR the serial text to find the matching item.
        </p>

        {/* Upload / Capture Dropzone */}
        {!imagePreview ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => {
              e.preventDefault()
              if (e.dataTransfer.files?.[0]) {
                processFile(e.dataTransfer.files[0])
              }
            }}
            className="border-2 border-dashed border-primary-200 hover:border-primary-400 bg-primary-50/40 hover:bg-primary-50 rounded-xl p-8 text-center cursor-pointer transition-colors"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={e => {
                if (e.target.files?.[0]) {
                  processFile(e.target.files[0])
                }
              }}
              className="hidden"
            />
            <div className="flex justify-center gap-3 text-primary-600 mb-2">
              <Camera size={32} />
              <Upload size={32} />
            </div>
            <p className="text-sm font-semibold text-gray-800">
              Click to Take Photo or Upload Image
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Supports Camera Snap, File Browse, Drag & Drop, or Paste from Clipboard (Ctrl+V)
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Image Preview & Controls */}
            <div className="relative border border-gray-200 rounded-lg p-2 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={imagePreview}
                  alt="Captured code"
                  className="w-16 h-16 object-cover rounded border border-gray-300 bg-white"
                />
                <div>
                  <p className="text-xs font-medium text-gray-700">{imageFile?.name ?? 'Captured Photo'}</p>
                  <p className="text-xs text-gray-400">{(Number(imageFile?.size ?? 0) / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetState()
                  fileInputRef.current?.click()
                }}
                className="px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors border border-primary-200"
              >
                Change Photo
              </button>
            </div>

            {/* Analysis State */}
            {analyzing && (
              <div className="p-5 border border-blue-100 bg-blue-50/60 rounded-xl flex items-center justify-center gap-3 text-blue-700 text-sm font-medium">
                <Loader2 size={20} className="animate-spin text-blue-600" />
                Scanning barcode and running OCR text recognition…
              </div>
            )}

            {/* Analysis Result */}
            {!analyzing && scanResult && (
              <div className="space-y-3">
                {scanResult.found && scanResult.match ? (
                  <div className="p-4 border border-green-200 bg-green-50 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-green-800">
                        <CheckCircle2 size={16} className="text-green-600" />
                        {scanResult.message}
                      </span>
                      <span className="px-2 py-0.5 bg-green-200 text-green-800 rounded text-xs font-mono font-bold uppercase">
                        {scanResult.match.match_type}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-green-100 shadow-sm flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">
                          {scanResult.match.product_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {scanResult.match.variant_name}
                          {scanResult.match.sku ? ` · SKU: ${scanResult.match.sku}` : ''}
                        </p>
                        {scanResult.match.matched_serial && (
                          <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded text-xs font-mono font-bold">
                            #{scanResult.match.matched_serial}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 text-sm">
                          ৳{scanResult.match.selling_price.toLocaleString()}
                        </p>
                        <p className="text-xs text-green-600">
                          {scanResult.match.current_stock} in stock
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          onAddMatch(scanResult.match!)
                          handleClose()
                        }}
                        className="btn-primary flex items-center gap-1.5 text-sm py-2 px-4 shadow-sm"
                      >
                        <Plus size={16} /> Add to Cart
                        {scanResult.match.matched_serial ? ' with Serial' : ''}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border border-amber-200 bg-amber-50 rounded-xl space-y-2">
                    <div className="flex items-start gap-2 text-amber-800 text-xs">
                      <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">{scanResult.message}</p>
                        {scanResult.raw_text && (
                          <p className="mt-1 text-gray-600 font-mono text-[11px] bg-white/70 p-1.5 rounded border border-amber-100">
                            Raw OCR Text: "{scanResult.raw_text}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Manual Search Fallback */}
                    <div className="pt-2 border-t border-amber-200/60">
                      <p className="text-xs text-gray-600 mb-1.5 font-medium">
                        Type or edit the serial/barcode manually:
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          className="input text-xs py-1.5 flex-1 bg-white"
                          placeholder="e.g. CA-9011386-AP-260918-0011"
                          value={manualCode}
                          onChange={e => setManualCode(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') handleManualSearch() }}
                        />
                        <button
                          type="button"
                          disabled={manualLoading || !manualCode.trim()}
                          onClick={handleManualSearch}
                          className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 disabled:opacity-50"
                        >
                          {manualLoading ? 'Searching…' : 'Search'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button type="button" className="btn-secondary text-xs" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
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
  const [inStockCatalog, setInStockCatalog] = useState<InStockProductItem[]>([])
  const [catalogFilter, setCatalogFilter] = useState('')
  const [showCatalog, setShowCatalog] = useState(false)

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null)
  const [warrantyOption, setWarrantyOption] = useState<string>('DEFAULT')
  const [customWarranty, setCustomWarranty] = useState<string>('')
  const [qty, setQty] = useState(1)

  const [showScanModal, setShowScanModal] = useState(false)
  const [showPhotoModal, setShowPhotoModal] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<QuickLookupResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)

  // Load products list and in-stock catalog
  const loadCatalog = useCallback(async () => {
    try {
      const cat = await productService.getInStockCatalog()
      setInStockCatalog(cat)
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    productService.list({ per_page: 200, is_active: true })
      .then(r => setProducts(r.items as unknown as Product[]))
      .catch(() => toast.error('Failed to load products'))
    loadCatalog()
  }, [loadCatalog])

  // Quick lookup search debounce
  useEffect(() => {
    const q = searchQuery.trim()
    if (!q) {
      setSearchResults([])
      setShowSearchDropdown(false)
      return
    }
    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await productService.quickLookup(q)
        setSearchResults(results)
        setShowSearchDropdown(true)
      } catch {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Centralized helper to add item to cart
  const addItemToCart = (
    variant: ProductVariant,
    product: Product,
    quantity = 1,
    preAssignedSerial?: string,
    warrantyStr?: string,
    warrantyMo?: number,
  ) => {
    if (variant.current_stock <= 0) {
      toast.error(`${product.name} (${variant.name}) is out of stock!`)
      return
    }
    const defW = formatDefaultWarranty(variant.warranty_months)
    const wPeriod = warrantyStr ?? defW.period
    const wMonths = warrantyMo ?? defW.months

    const existingIdx = cart.findIndex(i => i.variant.id === variant.id && i.warranty_period === wPeriod)
    if (existingIdx >= 0) {
      const updated = [...cart]
      updated[existingIdx].quantity += quantity
      if (preAssignedSerial) {
        if (!updated[existingIdx].serials.includes(preAssignedSerial)) {
          updated[existingIdx].serials.push(preAssignedSerial)
        }
      }
      onUpdateCart(updated)
    } else {
      onUpdateCart([...cart, {
        variant,
        product,
        quantity,
        unit_price: Number(variant.selling_price),
        discount: 0,
        warranty_period: wPeriod,
        warranty_months: wMonths,
        serials: preAssignedSerial ? [preAssignedSerial] : [],
      }])
    }
    toast.success(
      preAssignedSerial
        ? `Added ${product.name} (${variant.name}) [Serial: #${preAssignedSerial}]`
        : `Added ${product.name} (${variant.name}) to cart`
    )
  }

  // Handle Quick Search selection
  const handleSelectSearchResult = (res: QuickLookupResult) => {
    if (res.matched_serial && cart.some(ci => ci.serials.includes(res.matched_serial!))) {
      toast.error(`Serial #${res.matched_serial} is already in the cart!`)
      return
    }
    let p = products.find(prod => prod.id === res.product_id)
    let v = p?.variants?.find(varnt => varnt.id === res.variant_id)
    if (!p || !v) {
      p = {
        id: res.product_id,
        business_id: 1,
        name: res.product_name,
        description: null,
        brand_id: null,
        brand_name: null,
        category_id: null,
        category_name: null,
        is_serialized: res.is_serialized,
        is_active: true,
        total_stock: res.current_stock,
        variants: [],
        created_at: new Date().toISOString(),
      } as Product
      v = {
        id: res.variant_id,
        product_id: res.product_id,
        name: res.variant_name,
        sku: res.sku,
        barcode: res.barcode,
        cost_price: 0,
        selling_price: res.selling_price,
        warranty_months: res.warranty_months,
        reorder_level: 0,
        current_stock: res.current_stock,
        in_stock_serials: res.available_serials.length,
        other_specs: null,
        is_active: true,
        created_at: new Date().toISOString(),
      } as ProductVariant
    }
    addItemToCart(v, p, 1, res.matched_serial ?? undefined)
    setSearchQuery('')
    setShowSearchDropdown(false)
  }

  // Handle addition from in-stock catalog
  const handleAddFromCatalog = (
    pItem: InStockProductItem,
    vItem: InStockVariantItem,
    serial?: string,
  ) => {
    if (serial && cart.some(ci => ci.serials.includes(serial))) {
      toast.error(`Serial #${serial} is already in the cart!`)
      return
    }
    let p = products.find(prod => prod.id === pItem.id)
    let v = p?.variants?.find(varnt => varnt.id === vItem.id)
    if (!p || !v) {
      p = {
        id: pItem.id,
        business_id: 1,
        name: pItem.name,
        description: null,
        brand_id: null,
        brand_name: pItem.brand_name,
        category_id: null,
        category_name: pItem.category_name,
        is_serialized: pItem.is_serialized,
        is_active: true,
        total_stock: pItem.total_stock,
        variants: [],
        created_at: new Date().toISOString(),
      } as Product
      v = {
        id: vItem.id,
        product_id: pItem.id,
        name: vItem.name,
        sku: vItem.sku,
        barcode: vItem.barcode,
        cost_price: vItem.cost_price,
        selling_price: vItem.selling_price,
        warranty_months: vItem.warranty_months,
        reorder_level: 0,
        current_stock: vItem.current_stock,
        in_stock_serials: vItem.available_serials.length,
        other_specs: null,
        is_active: true,
        created_at: new Date().toISOString(),
      } as ProductVariant
    }
    addItemToCart(v, p, 1, serial)
  }

  // Handle Live Camera Barcode Scan
  const handleBarcodeScan = async (code: string) => {
    try {
      const results = await productService.quickLookup(code)
      if (results && results.length > 0) {
        handleSelectSearchResult(results[0])
        return
      }
      toast.error(`No item found for barcode "${code}"`)
    } catch {
      toast.error(`Barcode scan failed for "${code}"`)
    }
  }

  // Add item from dropdown form
  const addToCartFromDropdown = () => {
    if (!selectedVariant || !selectedProduct) return
    const defaultW = formatDefaultWarranty(selectedVariant.warranty_months)
    let wPeriod = defaultW.period
    let wMonths = defaultW.months

    if (warrantyOption === 'CUSTOM') {
      wPeriod = customWarranty.trim() || 'No Warranty'
      wMonths = 0
    } else if (warrantyOption !== 'DEFAULT') {
      const preset = WARRANTY_PRESETS.find(p => p.period === warrantyOption)
      wPeriod = preset ? preset.period : warrantyOption
      wMonths = preset ? preset.months : 0
    }

    addItemToCart(selectedVariant, selectedProduct, qty, undefined, wPeriod, wMonths)
    setSelectedProduct(null)
    setSelectedVariant(null)
    setWarrantyOption('DEFAULT')
    setCustomWarranty('')
    setQty(1)
  }

  const removeItem = (idx: number) => {
    onUpdateCart(cart.filter((_, i) => i !== idx))
  }

  const updateQty = (idx: number, q: number) => {
    if (q < 1) return
    const updated = [...cart]
    updated[idx].quantity = q
    updated[idx].serials = []
    onUpdateCart(updated)
  }

  const updatePrice = (idx: number, price: number) => {
    const updated = [...cart]
    updated[idx].unit_price = price
    onUpdateCart(updated)
  }

  const updateWarranty = (idx: number, period: string, months: number) => {
    const updated = [...cart]
    updated[idx].warranty_period = period
    updated[idx].warranty_months = months
    onUpdateCart(updated)
  }

  const total = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0)
  const totalInStockVariants = inStockCatalog.reduce((sum, p) => sum + p.variants.length, 0)

  // Filter catalog
  const filteredCatalog = inStockCatalog.filter(p => {
    if (!catalogFilter.trim()) return true
    const q = catalogFilter.toLowerCase()
    return (
      p.name.toLowerCase().includes(q) ||
      (p.brand_name && p.brand_name.toLowerCase().includes(q)) ||
      (p.category_name && p.category_name.toLowerCase().includes(q)) ||
      p.variants.some(v =>
        v.name.toLowerCase().includes(q) ||
        (v.sku && v.sku.toLowerCase().includes(q)) ||
        (v.barcode && v.barcode.toLowerCase().includes(q)) ||
        v.available_serials.some(s => s.toLowerCase().includes(q))
      )
    )
  })

  return (
    <div className="space-y-5">
      {/* Add item Card */}
      <div className="card space-y-4">
        {/* Header with Title & Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div>
            <p className="font-semibold text-gray-800 text-sm">Add Products to Sale</p>
            <p className="text-xs text-gray-400">Type serial/barcode, pick from in-stock list, or scan with camera/photo</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Live Camera Scanner */}
            <button
              type="button"
              onClick={() => setShowScanModal(true)}
              className="px-3 py-1.5 rounded-lg border border-primary-200 bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
              title="Scan live barcode with webcam or iVCam"
            >
              <ScanLine size={14} /> Scan Barcode (Camera / iVCam)
            </button>

            {/* Photo / Picture Upload & OCR */}
            <button
              type="button"
              onClick={() => setShowPhotoModal(true)}
              className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
              title="Upload or take a photo of serial number or barcode"
            >
              <Camera size={14} /> Photo / Picture Scan
            </button>

            {/* In-Stock Catalog Accordion Toggle */}
            <button
              type="button"
              onClick={() => setShowCatalog(!showCatalog)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm ${
                showCatalog
                  ? 'border-emerald-400 bg-emerald-600 text-white'
                  : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
              }`}
              title="View products currently in stock and their serial numbers"
            >
              <Layers size={14} /> In-Stock Products & Serials ({totalInStockVariants})
              {showCatalog ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>

        {/* ─── Mode 1: Quick Type / Search Bar ─── */}
        <div className="relative">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="input pl-10 pr-10 text-sm w-full py-2.5 bg-gray-50/50 hover:bg-white focus:bg-white transition-colors border-gray-300 focus:border-primary-500 rounded-xl"
              placeholder="Type or paste Serial # (e.g. 260918-0011), Barcode, SKU, or Name... (Press Enter to add)"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchResults.length > 0) setShowSearchDropdown(true) }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (searchResults.length > 0) {
                    handleSelectSearchResult(searchResults[0])
                  }
                }
              }}
            />
            {isSearching ? (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <Loader2 size={16} className="animate-spin text-primary-500" />
              </div>
            ) : searchQuery ? (
              <button
                type="button"
                onClick={() => { setSearchQuery(''); setSearchResults([]); setShowSearchDropdown(false) }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={15} />
              </button>
            ) : null}
          </div>

          {/* Quick Search Suggestions Dropdown */}
          {showSearchDropdown && searchResults.length > 0 && (
            <div className="absolute z-20 top-full mt-1.5 left-0 right-0 bg-white rounded-xl shadow-xl border border-gray-200 divide-y divide-gray-100 max-h-80 overflow-y-auto">
              {searchResults.map((res, idx) => (
                <div
                  key={`${res.variant_id}-${res.matched_serial ?? idx}`}
                  onClick={() => handleSelectSearchResult(res)}
                  className="p-3 hover:bg-primary-50/60 cursor-pointer flex items-center justify-between transition-colors text-left"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 text-sm">{res.product_name}</span>
                      <span className="text-xs text-gray-500 font-medium">{res.variant_name}</span>
                      {res.match_type === 'serial' && res.matched_serial && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded font-mono text-xs font-bold flex items-center gap-1">
                          <Hash size={11} /> {res.matched_serial}
                        </span>
                      )}
                      {res.match_type === 'barcode' && res.barcode && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded font-mono text-xs">
                          Barcode: {res.barcode}
                        </span>
                      )}
                      {res.match_type === 'sku' && res.sku && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-800 rounded font-mono text-xs">
                          SKU: {res.sku}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400">
                      Warranty: {formatDefaultWarranty(res.warranty_months).period}
                      {res.is_serialized ? ' · Serialized Item' : ''}
                    </p>
                  </div>
                  <div className="text-right pl-3 shrink-0">
                    <p className="font-bold text-gray-900 text-sm">৳{res.selling_price.toLocaleString()}</p>
                    <span className="inline-block text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                      {res.current_stock} in stock
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── Mode 2: In-Stock Products & Serials Accordion ─── */}
        {showCatalog && (
          <div className="border border-emerald-200 bg-gradient-to-b from-emerald-50/50 to-white rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-emerald-600" />
                <span className="font-bold text-gray-800 text-sm">In-Stock Catalog & Available Serials</span>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                  {totalInStockVariants} items available
                </span>
              </div>
              <div className="relative w-64">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter in-stock list or serial…"
                  value={catalogFilter}
                  onChange={e => setCatalogFilter(e.target.value)}
                  className="input pl-8 py-1 text-xs w-full bg-white"
                />
              </div>
            </div>

            {filteredCatalog.length === 0 ? (
              <p className="text-center text-xs text-gray-400 py-6">No in-stock items match your filter.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                {filteredCatalog.map(prod => (
                  <div key={prod.id} className="p-3 bg-white rounded-lg border border-gray-200 shadow-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-gray-900 text-sm">{prod.name}</span>
                        {prod.brand_name && <span className="text-xs text-gray-400 ml-1.5">({prod.brand_name})</span>}
                        {prod.category_name && (
                          <span className="text-[11px] ml-2 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                            {prod.category_name}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 font-medium">
                        Total Stock: <strong className="text-gray-900">{prod.total_stock}</strong>
                      </span>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {prod.variants.map(v => (
                        <div key={v.id} className="pt-2 first:pt-0 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-gray-800">{v.name}</span>
                              {v.sku && <span className="text-gray-400 font-mono text-[11px]">SKU: {v.sku}</span>}
                              <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                {v.current_stock} in stock
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-gray-900">৳{v.selling_price.toLocaleString()}</span>
                              <button
                                type="button"
                                onClick={() => handleAddFromCatalog(prod, v)}
                                className="px-2.5 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded text-xs font-medium flex items-center gap-1 transition-colors"
                              >
                                <Plus size={13} /> Add
                              </button>
                            </div>
                          </div>

                          {/* Clickable In-Stock Serial Badges */}
                          {prod.is_serialized && v.available_serials.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-[11px] text-gray-500 font-medium flex items-center gap-0.5 mr-1">
                                <Hash size={11} className="text-blue-500" /> Click to add serial:
                              </span>
                              {v.available_serials.map(sn => {
                                const isAlreadyInCart = cart.some(ci => ci.serials.includes(sn))
                                return (
                                  <button
                                    key={sn}
                                    type="button"
                                    disabled={isAlreadyInCart}
                                    onClick={() => handleAddFromCatalog(prod, v, sn)}
                                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-all ${
                                      isAlreadyInCart
                                        ? 'bg-gray-100 text-gray-400 line-through cursor-not-allowed border border-gray-200'
                                        : 'bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200 active:scale-95 shadow-sm'
                                    }`}
                                    title={isAlreadyInCart ? 'Already added to cart' : `Click to add ${prod.name} with serial #${sn}`}
                                  >
                                    #{sn}
                                  </button>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Mode 3: Standard Dropdown Selector ─── */}
        <div className="pt-1">
          <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Or Select Manually:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="label">Product</label>
              <select
                className="input"
                value={selectedProduct?.id ?? ''}
                onChange={e => {
                  const p = products.find(x => x.id === Number(e.target.value)) ?? null
                  setSelectedProduct(p)
                  setSelectedVariant(null)
                  setWarrantyOption('DEFAULT')
                  setCustomWarranty('')
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
                  setWarrantyOption('DEFAULT')
                  setCustomWarranty('')
                }}
              >
                <option value="">— Select Variant —</option>
                {selectedProduct?.variants?.filter(v => v.is_active).map(v => (
                  <option key={v.id} value={v.id} disabled={v.current_stock <= 0}>
                    {v.name} — {v.current_stock <= 0 ? 'Stock Out' : `${v.current_stock} in stock`} — {formatCurrency(v.selling_price)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label flex items-center gap-1">
                <Shield size={12} className="text-primary-600" /> Warranty
              </label>
              <select
                className="input"
                disabled={!selectedVariant}
                value={warrantyOption}
                onChange={e => setWarrantyOption(e.target.value)}
              >
                <option value="DEFAULT">
                  Default ({selectedVariant ? formatDefaultWarranty(selectedVariant.warranty_months).period : 'from product'})
                </option>
                {WARRANTY_PRESETS.map(p => (
                  <option key={p.period} value={p.period}>{p.label}</option>
                ))}
                <option value="CUSTOM">Custom Warranty…</option>
              </select>
              {warrantyOption === 'CUSTOM' && (
                <input
                  type="text"
                  className="input mt-1.5 text-xs py-1"
                  placeholder="e.g. 18 Months Official"
                  value={customWarranty}
                  onChange={e => setCustomWarranty(e.target.value)}
                />
              )}
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
                className="btn-primary w-full flex items-center justify-center gap-2 py-2"
                disabled={!selectedVariant}
                onClick={addToCartFromDropdown}
              >
                <Plus size={15} /> Add
              </button>
            </div>
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
                <th className="text-left px-3 py-3 font-medium text-gray-600 w-44">Warranty</th>
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
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[11px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-medium">Serialized</span>
                        {item.serials.filter(Boolean).map(sn => (
                          <span key={sn} className="text-[11px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-mono font-bold">
                            #{sn}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="input py-1 px-2 text-xs w-full bg-white font-medium text-gray-700"
                      value={item.warranty_period}
                      onChange={e => {
                        const val = e.target.value
                        const preset = WARRANTY_PRESETS.find(p => p.period === val)
                        updateWarranty(idx, val, preset ? preset.months : 0)
                      }}
                    >
                      {!WARRANTY_PRESETS.some(p => p.period === item.warranty_period) && (
                        <option value={item.warranty_period}>{item.warranty_period}</option>
                      )}
                      {WARRANTY_PRESETS.map(p => (
                        <option key={p.period} value={p.period}>{p.label}</option>
                      ))}
                    </select>
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
                <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700 text-right">
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

      {/* Barcode Scanner Modal for POS (Camera / iVCam) */}
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

      {/* Photo / Picture Scan Modal (Upload / Snap Photo) */}
      <PhotoScanModal
        isOpen={showPhotoModal}
        onClose={() => setShowPhotoModal(false)}
        onAddMatch={handleSelectSearchResult}
      />
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
  const [inStockMap, setInStockMap] = useState<Record<number, string[]>>({})
  const [activeScanTarget, setActiveScanTarget] = useState<{ cartIdx: number; si: number } | null>(null)

  // Fetch real in-stock serials for each serialized variant in cart
  useEffect(() => {
    let isMounted = true
    const loadInStock = async () => {
      const map: Record<number, string[]> = {}
      for (const item of serializedItems) {
        try {
          const serials = await productService.getInStockSerials(item.variant.id)
          map[item.variant.id] = serials
        } catch {
          map[item.variant.id] = []
        }
      }
      if (isMounted) setInStockMap(map)
    }
    if (serializedItems.length > 0) {
      loadInStock()
    }
    return () => { isMounted = false }
  }, [cart])

  const handleChange = (cartIdx: number, si: number, value: string) => {
    const realIdx = cart.indexOf(serializedItems[cartIdx])
    const updated = [...cart[realIdx].serials]
    updated[si] = value.trim().toUpperCase()
    onUpdateSerials(realIdx, updated)
  }

  const handlePickSerial = (cartIdx: number, serial: string) => {
    const realIdx = cart.indexOf(serializedItems[cartIdx])
    const current = [...cart[realIdx].serials]
    // Find first empty slot or replace
    const emptyIdx = current.findIndex(s => !s || s.trim().length === 0)
    if (emptyIdx >= 0) {
      current[emptyIdx] = serial
    } else {
      current[0] = serial
    }
    onUpdateSerials(realIdx, current)
  }

  const handleAutoFill = (cartIdx: number) => {
    const item = serializedItems[cartIdx]
    const realIdx = cart.indexOf(item)
    const available = inStockMap[item.variant.id] || []
    if (available.length === 0) {
      toast.error('No pre-registered in-stock serials found for this variant.')
      return
    }
    const updated = Array(item.quantity).fill('')
    for (let i = 0; i < item.quantity; i++) {
      if (i < available.length) {
        updated[i] = available[i]
      }
    }
    onUpdateSerials(realIdx, updated)
    toast.success(`Assigned ${Math.min(item.quantity, available.length)} in-stock serials`)
  }

  useEffect(() => {
    cart.forEach((item, idx) => {
      if (item.product.is_serialized && item.serials.length !== item.quantity) {
        const current = [...(item.serials || [])]
        while (current.length < item.quantity) current.push('')
        onUpdateSerials(idx, current.slice(0, item.quantity))
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
          const available = inStockMap[item.variant.id] || []
          return (
            <div key={cartIdx} className="card space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 flex-shrink-0">
                    <Tag size={17} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{item.product.name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-gray-500">{item.variant.name} — {item.quantity} unit{item.quantity > 1 ? 's' : ''}</p>
                      {item.warranty_period && (
                        <span className="text-[11px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                          <Shield size={10} className="text-blue-500" /> {item.warranty_period}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {available.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleAutoFill(cartIdx)}
                    className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg flex items-center gap-1.5 transition-colors border border-blue-200"
                  >
                    <Sparkles size={13} className="text-blue-600" /> Auto-fill In-Stock
                  </button>
                )}
              </div>

              {/* In-stock serial badges */}
              {available.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      Available In Stock ({available.length}):
                    </span>
                    <span className="text-[11px] text-slate-400">Click any serial to pick</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-0.5">
                    {available.map(sn => {
                      const isSelected = item.serials.includes(sn)
                      return (
                        <button
                          key={sn}
                          type="button"
                          onClick={() => handlePickSerial(cartIdx, sn)}
                          className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                            isSelected
                              ? 'bg-blue-600 text-white font-semibold shadow-xs'
                              : 'bg-white text-slate-700 border border-slate-200 hover:border-blue-400 hover:text-blue-600'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '} {sn}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Serial inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Array.from({ length: item.quantity }).map((_, si) => (
                  <div key={si} className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{si + 1}.</span>
                    <input
                      className={`input text-sm font-mono uppercase flex-1 ${
                        (item.serials[si] || '').trim().length > 0 ? 'border-green-300 focus:ring-green-400' : ''
                      }`}
                      placeholder={`Serial #${si + 1}`}
                      value={item.serials[si] || ''}
                      onChange={e => handleChange(cartIdx, si, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setActiveScanTarget({ cartIdx, si })}
                      title="Scan barcode with camera / phone iVCam"
                      className="p-2 border border-gray-200 rounded-lg text-gray-500 hover:text-blue-600 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                    >
                      <ScanLine size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400">
                {item.serials.filter(s => s.trim().length > 0).length} / {item.quantity} entered • Click a pill above, scan via camera, or type any serial on the box.
              </p>
            </div>
          )
        })
      )}

      {/* Serial Barcode Scanner Modal */}
      <Modal
        isOpen={activeScanTarget !== null}
        onClose={() => setActiveScanTarget(null)}
        title="Scan Serial Barcode (Webcam / Phone iVCam)"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">
            Point camera at the serial number barcode on the box to scan it directly into the input.
          </p>
          <BarcodeScanner
            onScan={(barcode) => {
              if (activeScanTarget) {
                handleChange(activeScanTarget.cartIdx, activeScanTarget.si, barcode)
                toast.success(`Scanned serial: ${barcode}`)
                setActiveScanTarget(null)
              }
            }}
          />
          <div className="flex justify-end pt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setActiveScanTarget(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

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
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs text-gray-500">{item.variant.name}{item.variant.sku ? ` · ${item.variant.sku}` : ''}</p>
                  {item.warranty_period && (
                    <span className="text-[11px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100 flex items-center gap-1">
                      <Shield size={10} className="text-blue-500" /> Warranty: {item.warranty_period}
                    </span>
                  )}
                </div>
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
  const [completedSale, setCompletedSale] = useState<Sale | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    customerService.list({ per_page: 200 }).then(r => setCustomers(r.items))
  }, [])

  const updateSerials = (idx: number, serials: string[]) => {
    setCart(prev => { const c = [...prev]; c[idx] = { ...c[idx], serials }; return c })
  }

  const printInvoicePDF = async (saleObj: Sale) => {
    setDownloading(true)
    try {
      const response = await api.get(`/sales/${saleObj.id}/invoice`, { responseType: 'blob' })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)

      // Use hidden iframe to reliably trigger native print dialog
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      iframe.src = url
      document.body.appendChild(iframe)
      iframe.onload = () => {
        setTimeout(() => {
          iframe.focus()
          try {
            iframe.contentWindow?.print()
          } catch {
            window.open(url, '_blank')
          }
        }, 300)
      }
      toast.success('Opening print dialog…')
    } catch {
      toast.error('Failed to generate invoice for printing')
    } finally {
      setDownloading(false)
    }
  }

  const downloadInvoicePDF = async (saleObj: Sale) => {
    setDownloading(true)
    try {
      const response = await api.get(`/sales/${saleObj.id}/invoice`, { responseType: 'blob' })
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `invoice_${saleObj.sale_number}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Invoice PDF downloaded!')
    } catch {
      toast.error('Failed to download invoice PDF')
    } finally {
      setDownloading(false)
    }
  }

  const startNewSale = () => {
    setCompletedSale(null)
    setCart([])
    setDetails({
      customer_id: null,
      sale_date: today,
      paid_amount: 0,
      discount_amount: 0,
      loyalty_points_redeemed: 0,
      notes: '',
    })
    setStep(0)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const items: SaleItemCreate[] = cart.map(item => ({
        variant_id:      item.variant.id,
        quantity:        item.quantity,
        unit_price:      item.unit_price,
        discount_amount: item.discount,
        warranty_period: item.warranty_period,
        warranty_months: item.warranty_months,
        serials:         item.serials.filter(Boolean).map(s => ({ serial: s })),
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
      setCompletedSale(sale)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to complete sale'
      toast.error(typeof msg === 'string' ? msg : 'Failed to complete sale')
    } finally {
      setSubmitting(false)
    }
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

      {/* Sale Completion / Print & Download Modal */}
      {completedSale && (
        <Modal
          isOpen={true}
          onClose={() => navigate(`/sales/${completedSale.id}`)}
          title="Sale Confirmed & Completed!"
          maxWidth="md"
        >
          <div className="space-y-5 text-center py-2">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <Check size={36} />
            </div>

            <div>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 font-mono text-xs rounded-full font-semibold">
                Invoice #{completedSale.sale_number}
              </span>
              <h3 className="text-xl font-bold text-gray-900 mt-2">
                Sale Recorded Successfully
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Net Payable: <span className="font-semibold text-gray-900">{formatCurrency(completedSale.net_payable)}</span> • Status:{' '}
                <span className="font-semibold text-emerald-600">{completedSale.payment_status}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => printInvoicePDF(completedSale)}
                disabled={downloading}
                className="btn-primary flex items-center justify-center gap-2 py-3 text-sm shadow-sm"
              >
                {downloading ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
                Print Memo
              </button>
              <button
                type="button"
                onClick={() => downloadInvoicePDF(completedSale)}
                disabled={downloading}
                className="btn-secondary flex items-center justify-center gap-2 py-3 text-sm border-blue-200 text-blue-700 hover:bg-blue-50"
              >
                {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Download PDF
              </button>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={startNewSale}
                className="text-sm text-gray-600 hover:text-gray-900 font-medium flex items-center gap-1.5"
              >
                <Plus size={16} /> Start New Sale
              </button>
              <button
                type="button"
                onClick={() => navigate(`/sales/${completedSale.id}`)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1.5"
              >
                View Details <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
