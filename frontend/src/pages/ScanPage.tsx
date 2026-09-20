/**
 * Scan product page — updated with Live Camera, Photo / Picture Upload & OCR, and Type/Search.
 *
 * Three input modes via tab toggle:
 *   Camera — live barcode scanner (supports iVCam virtual camera)
 *   Photo  — upload or snap a photo of a barcode/serial label (works on any device without HTTPS/webcam restrictions)
 *   Type   — manual barcode / SKU / product name entry
 *
 * On a match, shows a product card with stock, price, and quick actions.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ScanLine, Search, Package, AlertTriangle,
  ArrowRight, RotateCcw, TrendingDown,
  CheckCircle, Camera, Keyboard, Smartphone,
  Upload, Image as ImageIcon, Sparkles, ShoppingCart,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BrowserMultiFormatReader } from '@zxing/browser'
import toast from 'react-hot-toast'
import BarcodeScanner from '@/components/scanner/BarcodeScanner'
import StockAdjustmentModal from '@/components/inventory/StockAdjustmentModal'
import { productService, type ScanResult } from '@/services/productService'
import { useAuthStore } from '@/services/authStore'
import { formatCurrency } from '@/utils/format'

type InputMode = 'camera' | 'photo' | 'type'
type ScanState = 'idle' | 'found' | 'not_found'

export default function ScanPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const canAdjust = hasPermission('adjust_inventory')

  const [mode, setMode]           = useState<InputMode>('camera')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [result, setResult]       = useState<ScanResult | null>(null)
  const [lastScanned, setLastScanned] = useState('')
  const [manualInput, setManualInput] = useState('')
  const [loading, setLoading]     = useState(false)
  const [showAdjust, setShowAdjust] = useState(false)

  // Photo scan state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [dragActive, setDragActive]     = useState(false)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef   = useRef<HTMLInputElement>(null)

  // Clean up object URLs on unmount/change
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  // ── Lookup ────────────────────────────────────────────────────────────────
  const lookup = useCallback(async (value: string, hint: 'barcode' | 'sku' = 'barcode') => {
    const v = value.trim()
    if (!v) return
    setLoading(true)
    setLastScanned(v)
    setScanState('idle')

    try {
      const data = await productService.scan(
        hint === 'barcode' ? { barcode: v } : { sku: v }
      )
      setResult(data)
      setScanState('found')
    } catch (err: any) {
      if (err?.response?.status === 404) {
        // Try the other mode before giving up
        try {
          const retry = await productService.scan(
            hint === 'barcode' ? { sku: v } : { barcode: v }
          )
          setResult(retry)
          setScanState('found')
          return
        } catch { /* fall through */ }
        setResult(null)
        setScanState('not_found')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  const handleScan = useCallback((barcode: string) => lookup(barcode, 'barcode'), [lookup])

  // ── Photo Processing ───────────────────────────────────────────────────────
  const processPhoto = useCallback(async (file: File) => {
    const objUrl = URL.createObjectURL(file)
    setPhotoPreview(objUrl)
    setLoading(true)
    setScanState('idle')

    // 1. First try instant client barcode decoding via ZXing
    try {
      const reader = new BrowserMultiFormatReader()
      const decoded = await reader.decodeFromImageUrl(objUrl)
      if (decoded) {
        const code = decoded.getText().trim()
        if (code) {
          toast.success(`Barcode detected: ${code}`)
          await lookup(code, 'barcode')
          setLoading(false)
          return
        }
      }
    } catch {
      // Not a 1D barcode or unreadable by zxing
    }

    // 2. Try backend OCR & inventory lookup
    try {
      const scanRes = await productService.scanImage(file)
      if (scanRes.found && scanRes.match) {
        toast.success(`Found product: ${scanRes.match.product_name}`)
        const code = scanRes.match.matched_serial || scanRes.match.barcode || scanRes.match.sku
        if (code) {
          await lookup(code, scanRes.match.matched_serial ? 'sku' : (scanRes.match.barcode ? 'barcode' : 'sku'))
        } else {
          setResult({
            variant_id: scanRes.match.variant_id,
            variant_name: scanRes.match.variant_name,
            sku: scanRes.match.sku,
            barcode: scanRes.match.barcode,
            product_id: scanRes.match.product_id,
            product_name: scanRes.match.product_name,
            is_serialized: scanRes.match.is_serialized,
            brand_name: null,
            category_name: null,
            cost_price: 0,
            selling_price: scanRes.match.selling_price,
            current_stock: scanRes.match.current_stock,
            reorder_level: 5,
            in_stock_serials: scanRes.match.available_serials?.length || null,
            is_low_stock: scanRes.match.current_stock <= 5,
            warranty_months: scanRes.match.warranty_months,
            matched_serial: scanRes.match.matched_serial,
          })
          setScanState('found')
        }
      } else {
        setResult(null)
        setScanState('not_found')
        setLastScanned(scanRes.detected_code || 'photo')
        toast.error(scanRes.message || 'No matching in-stock product found in image')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to scan image')
      setScanState('not_found')
      setLastScanned('photo')
    } finally {
      setLoading(false)
    }
  }, [lookup])

  // Clipboard paste support (Ctrl+V) when in Photo mode
  useEffect(() => {
    if (mode !== 'photo') return
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const blob = items[i].getAsFile()
          if (blob) {
            processPhoto(blob)
            break
          }
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [mode, processPhoto])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualInput.trim()) return
    const isNumericBarcode = /^\d{8,}$/.test(manualInput.trim())
    lookup(manualInput.trim(), isNumericBarcode ? 'barcode' : 'sku')
  }

  const reset = () => {
    setResult(null)
    setScanState('idle')
    setLastScanned('')
    setManualInput('')
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview)
      setPhotoPreview(null)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-lg mx-auto">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Scan Product</h2>
        <p className="text-sm text-gray-500 mt-0.5">Look up any product by barcode, SKU, serial, or photo</p>
      </div>

      {/* Phone scanning tip banner */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-blue-800">
        <div className="flex items-center gap-2">
          <Smartphone size={16} className="text-blue-600 flex-shrink-0" />
          <span>
            <strong>Phone Scanning:</strong> Use <strong>iVCam</strong> for live video, or use <strong>Photo / Picture</strong> to snap photos directly!
          </span>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        {([
          { key: 'camera', label: 'Camera Scan', icon: Camera },
          { key: 'photo',  label: 'Photo / Upload', icon: Upload },
          { key: 'type',   label: 'Type / Search', icon: Keyboard },
        ] as { key: InputMode; label: string; icon: React.ElementType }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => { setMode(tab.key); reset() }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
              mode === tab.key
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Camera mode ──────────────────────────────────────────────────── */}
      {mode === 'camera' && (
        <BarcodeScanner
          onScan={handleScan}
          paused={scanState === 'found'}
          onSwitchToPhoto={() => { setMode('photo'); reset() }}
        />
      )}

      {/* ── Photo mode ───────────────────────────────────────────────────── */}
      {mode === 'photo' && scanState !== 'found' && (
        <div className="card space-y-4">
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) processPhoto(f)
              e.target.value = ''
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) processPhoto(f)
              e.target.value = ''
            }}
          />

          {!photoPreview ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragActive(false)
                const f = e.dataTransfer.files?.[0]
                if (f) processPhoto(f)
              }}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                dragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400 bg-gray-50/50'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center mx-auto mb-3">
                <ImageIcon size={22} />
              </div>
              <p className="text-sm font-semibold text-gray-800 mb-1">
                Upload or Take a Photo of Label / Barcode
              </p>
              <p className="text-xs text-gray-500 mb-4 max-w-xs mx-auto">
                Snap with your phone camera, upload an image, or paste with Ctrl+V.
                Decodes barcodes and recognizes serial numbers via OCR.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-sm"
                >
                  <Camera size={14} />
                  Take Photo (Camera)
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5"
                >
                  <Upload size={14} />
                  Choose File
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-900 max-h-52 flex items-center justify-center">
                <img
                  src={photoPreview}
                  alt="Scanned item preview"
                  className="max-h-52 w-auto object-contain"
                />
                <button
                  type="button"
                  onClick={reset}
                  className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white text-xs px-2.5 py-1 rounded-md flex items-center gap-1 backdrop-blur-sm transition-colors"
                >
                  <RotateCcw size={12} /> Change Photo
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Type mode ────────────────────────────────────────────────────── */}
      {mode === 'type' && scanState !== 'found' && (
        <form onSubmit={handleManualSubmit} className="space-y-3">
          <div className="card space-y-3">
            <p className="text-sm font-medium text-gray-700">Enter barcode, SKU, or search by name</p>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="input pl-9 font-mono"
                  placeholder="e.g. 8901234567890 or AK820-BLU"
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <button
                type="submit"
                className="btn-primary px-5"
                disabled={!manualInput.trim() || loading}
              >
                {loading
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                  : 'Search'
                }
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Accepts: barcode number · SKU code · serial number · or paste from a scanner device
            </p>
          </div>
        </form>
      )}

      {/* Also show manual input below camera or photo when active & idle */}
      {mode !== 'type' && scanState !== 'found' && (
        <form onSubmit={handleManualSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Keyboard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9 text-sm font-mono"
              placeholder="Or type barcode / SKU here…"
              value={manualInput}
              onChange={e => setManualInput(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className="btn-secondary text-sm px-4"
            disabled={!manualInput.trim() || loading}
          >
            Go
          </button>
        </form>
      )}

      {/* Loading */}
      {loading && (
        <div className="card flex items-center gap-3 text-gray-600">
          <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
          <p className="text-sm">Looking up product &amp; extracting codes…</p>
        </div>
      )}

      {/* Not found */}
      {scanState === 'not_found' && !loading && (
        <div className="card border-l-4 border-red-400 bg-red-50">
          <div className="flex items-start gap-3">
            <Package size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-900">Product not found</p>
              <p className="text-sm text-red-700 mt-1">
                No matching product found for{' '}
                <span className="font-mono bg-red-100 px-1 rounded">{lastScanned}</span>
              </p>
              <p className="text-xs text-red-600 mt-1">
                Check that the barcode/serial is clear, or make sure the product is added to inventory.
              </p>
            </div>
            <button onClick={reset} className="text-red-600 hover:text-red-800 flex-shrink-0" title="Try again">
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
      )}

      {/* ── Result card ────────────────────────────────────────────────── */}
      {scanState === 'found' && result && !loading && (
        <div className="card space-y-4 animate-in fade-in zoom-in-95 duration-200">
          {/* Title */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                <p className="font-bold text-gray-900 text-lg leading-tight">{result.product_name}</p>
              </div>
              <p className="text-sm text-gray-600 mt-1">{result.variant_name}</p>
            </div>
            <button
              onClick={reset}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              title="Scan / search again"
            >
              <RotateCcw size={16} />
            </button>
          </div>

          {/* Chips */}
          <div className="flex flex-wrap gap-2">
            {result.brand_name && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{result.brand_name}</span>
            )}
            {result.category_name && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{result.category_name}</span>
            )}
            {result.sku && (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-mono">SKU: {result.sku}</span>
            )}
            {result.barcode && (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-mono">BC: {result.barcode}</span>
            )}
            {result.matched_serial && (
              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-full font-mono">SN: {result.matched_serial}</span>
            )}
          </div>

          {/* Stock / price grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className={`p-3 rounded-xl text-center ${result.is_low_stock ? 'bg-red-50' : 'bg-green-50'}`}>
              <p className={`text-2xl font-bold ${result.is_low_stock ? 'text-red-600' : 'text-green-600'}`}>
                {result.current_stock}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">In Stock</p>
            </div>
            <div className="p-3 rounded-xl text-center bg-gray-50">
              <p className="text-2xl font-bold text-gray-700">{result.reorder_level}</p>
              <p className="text-xs text-gray-500 mt-0.5">Reorder At</p>
            </div>
            <div className="p-3 rounded-xl text-center bg-blue-50">
              <p className="text-lg font-bold text-blue-700">{formatCurrency(result.selling_price)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Sell Price</p>
            </div>
          </div>

          {/* Serial info */}
          {result.is_serialized && result.in_stock_serials !== null && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <ScanLine size={14} className="text-gray-400" />
              Serialized · {result.in_stock_serials} serial{result.in_stock_serials !== 1 ? 's' : ''} IN_STOCK
            </div>
          )}

          {/* Low stock alert */}
          {result.is_low_stock && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">
                <span className="font-semibold">Low stock!</span>{' '}
                {result.current_stock} left — reorder level is {result.reorder_level}.
              </p>
            </div>
          )}

          {/* Warranty */}
          {result.warranty_months > 0 && (
            <p className="text-xs text-gray-500">
              Warranty: {result.warranty_months} month{result.warranty_months !== 1 ? 's' : ''}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={() => navigate('/pos')}
              className="flex-1 btn-primary text-xs py-2 flex items-center justify-center gap-1.5"
            >
              <ShoppingCart size={14} /> Sell in POS
            </button>
            {canAdjust && (
              <button
                onClick={() => setShowAdjust(true)}
                className="flex-1 btn-secondary text-xs py-2 flex items-center justify-center gap-1.5"
              >
                <TrendingDown size={14} /> Adjust Stock
              </button>
            )}
            <button
              onClick={() => navigate(`/products/${result.product_id}`)}
              className="btn-secondary text-xs py-2 px-3 flex items-center justify-center gap-1"
            >
              Details <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      <StockAdjustmentModal
        isOpen={showAdjust}
        onClose={() => setShowAdjust(false)}
        onAdjusted={() => { if (lastScanned) lookup(lastScanned, 'barcode') }}
      />
    </div>
  )
}
