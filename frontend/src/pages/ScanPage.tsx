/**
 * Scan product page — Phase 6.
 *
 * Uses the phone/laptop camera to scan a barcode or allows manual
 * SKU / barcode entry. On a successful scan, looks up the product
 * variant and shows a rich product card with:
 *   - Product name, brand, category
 *   - Variant name and SKU
 *   - Current stock + low-stock warning
 *   - Selling price
 *   - Quick actions: view product, adjust stock
 */

import { useState, useCallback } from 'react'
import {
  ScanLine, Search, Package, AlertTriangle,
  ArrowRight, RotateCcw, TrendingDown,
  CheckCircle, Barcode,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BarcodeScanner from '@/components/scanner/BarcodeScanner'
import StockAdjustmentModal from '@/components/inventory/StockAdjustmentModal'
import { productService, type ScanResult } from '@/services/productService'
import { useAuthStore } from '@/services/authStore'
import { formatCurrency } from '@/utils/format'

type ScanState = 'scanning' | 'found' | 'not_found' | 'manual'

export default function ScanPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const canAdjust = hasPermission('adjust_inventory')

  const [scanState, setScanState] = useState<ScanState>('scanning')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [lastScanned, setLastScanned] = useState<string>('')
  const [manualInput, setManualInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)

  const lookup = useCallback(async (value: string, mode: 'barcode' | 'sku' = 'barcode') => {
    if (!value.trim()) return
    setLoading(true)
    setLastScanned(value)

    try {
      const data = await productService.scan(
        mode === 'barcode' ? { barcode: value } : { sku: value }
      )
      setResult(data)
      setScanState('found')
    } catch (err: any) {
      if (err?.response?.status === 404) {
        setResult(null)
        setScanState('not_found')
      }
      // Other errors handled by interceptor
    } finally {
      setLoading(false)
    }
  }, [])

  const handleScan = useCallback((barcode: string) => {
    lookup(barcode, 'barcode')
  }, [lookup])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualInput.trim()) return
    // Heuristic: if it looks purely numeric and long, treat as barcode; else SKU
    const isBarcode = /^\d{8,}$/.test(manualInput.trim())
    lookup(manualInput.trim(), isBarcode ? 'barcode' : 'sku')
    setScanState('scanning') // switch back to scanner view temporarily
  }

  const reset = () => {
    setResult(null)
    setScanState('scanning')
    setLastScanned('')
    setManualInput('')
  }

  return (
    <div className="space-y-5 max-w-lg mx-auto">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Scan Product</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Point camera at a barcode or enter SKU manually
        </p>
      </div>

      {/* Camera scanner — shown when not paused */}
      <BarcodeScanner
        onScan={handleScan}
        paused={scanState === 'found'}
      />

      {/* Manual entry form */}
      <form onSubmit={handleManualSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Barcode size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Enter barcode or SKU manually…"
            value={manualInput}
            onChange={e => setManualInput(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="btn-primary flex items-center gap-2 px-4"
          disabled={!manualInput.trim() || loading}
        >
          <Search size={16} /> Look up
        </button>
      </form>

      {/* Loading state */}
      {loading && (
        <div className="card flex items-center gap-3 text-gray-600">
          <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Looking up product…</p>
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
                No variant matches <span className="font-mono bg-red-100 px-1 rounded">{lastScanned}</span>
              </p>
            </div>
            <button
              onClick={reset}
              className="text-red-600 hover:text-red-800"
              title="Scan again"
            >
              <RotateCcw size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Found — product card */}
      {scanState === 'found' && result && !loading && (
        <div className="card space-y-4">

          {/* Header row */}
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
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              title="Scan again"
            >
              <RotateCcw size={16} />
            </button>
          </div>

          {/* Meta chips */}
          <div className="flex flex-wrap gap-2">
            {result.brand_name && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                {result.brand_name}
              </span>
            )}
            {result.category_name && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                {result.category_name}
              </span>
            )}
            {result.sku && (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-mono">
                SKU: {result.sku}
              </span>
            )}
            {result.barcode && (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-mono">
                {result.barcode}
              </span>
            )}
          </div>

          {/* Stock + price grid */}
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
              <p className="text-xs text-gray-500 mt-0.5">Selling Price</p>
            </div>
          </div>

          {/* Serialized badge + serial count */}
          {result.is_serialized && result.in_stock_serials !== null && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <ScanLine size={14} className="text-gray-400" />
              Serialized product — {result.in_stock_serials} serials IN_STOCK
            </div>
          )}

          {/* Low-stock alert */}
          {result.is_low_stock && (
            <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700">
                <span className="font-semibold">Low stock!</span> {result.current_stock} left, reorder level is {result.reorder_level}.
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
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button
              onClick={() => navigate(`/products/${result.product_id}`)}
              className="flex-1 btn-secondary flex items-center justify-center gap-2"
            >
              View Product <ArrowRight size={15} />
            </button>
            {canAdjust && (
              <button
                onClick={() => setShowAdjustModal(true)}
                className="flex-1 btn-primary flex items-center justify-center gap-2"
              >
                <TrendingDown size={15} /> Adjust Stock
              </button>
            )}
          </div>
        </div>
      )}

      {/* Adjustment modal */}
      <StockAdjustmentModal
        isOpen={showAdjustModal}
        onClose={() => setShowAdjustModal(false)}
        onAdjusted={() => {
          // Re-fetch the same product to show updated stock
          if (lastScanned) lookup(lastScanned, 'barcode')
        }}
      />
    </div>
  )
}
