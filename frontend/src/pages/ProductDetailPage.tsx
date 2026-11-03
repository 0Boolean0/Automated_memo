/**
 * Product detail page.
 * Shows full product info, all variants with pricing, and serial count.
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Pencil, Loader2, Package, Barcode,
  TrendingUp, Shield, AlertTriangle, Plus, History,
  SlidersHorizontal, Trash2, Hash, Sparkles, Tag,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import ProductFormModal from '@/components/products/ProductFormModal'
import StockAdjustmentModal from '@/components/inventory/StockAdjustmentModal'
import ClearStockModal from '@/components/inventory/ClearStockModal'
import SerialManagerModal from '@/components/products/SerialManagerModal'
import { productService, categoryService, brandService } from '@/services/productService'
import type { Product, ProductVariant, PriceHistory, Category, Brand } from '@/services/productService'
import { useAuthStore } from '@/services/authStore'
import { formatCurrency, formatDate, formatDateTime, profitMargin } from '@/utils/format'

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const canEdit = hasPermission('edit_product')
  const canAdjust = hasPermission('adjust_inventory')

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [selectedVariantId, setSelectedVariantId] = useState<number | undefined>(undefined)
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyVariant, setHistoryVariant] = useState<ProductVariant | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands] = useState<Brand[]>([])

  // Clear stock modal state
  const [showClearModal, setShowClearModal] = useState(false)
  const [clearTargetVariant, setClearTargetVariant] = useState<ProductVariant | null>(null)

  // Serial manager modal state
  const [showSerialModal, setShowSerialModal] = useState(false)
  const [serialVariantId, setSerialVariantId] = useState<number | undefined>(undefined)

  const fetchProduct = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [p, cats, brds] = await Promise.all([
        productService.get(Number(id)),
        categoryService.list(),
        brandService.list(),
      ])
      setProduct(p)
      setCategories(cats)
      setBrands(brds)
    } catch {
      toast.error('Product not found')
      navigate('/products')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchProduct() }, [id])

  const openPriceHistory = async (v: ProductVariant) => {
    setHistoryVariant(v)
    const hist = await productService.getPriceHistory(v.id)
    setPriceHistory(hist)
    setShowHistory(true)
  }

  if (loading) return (
    <div className="flex justify-center py-20"><Loader2 size={32} className="animate-spin text-primary-500" /></div>
  )
  if (!product) return null

  const activeVariants = product.variants.filter(v => v.is_active)

  return (
    <div className="space-y-5 max-w-4xl">

      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <button onClick={() => navigate('/products')} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 mt-0.5">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            <Badge variant={product.is_serialized ? 'blue' : 'gray'}>
              {product.is_serialized ? 'Serialized' : 'Non-serialized'}
            </Badge>
            <Badge variant={product.is_active ? 'green' : 'gray'}>
              {product.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {[product.brand_name, product.category_name].filter(Boolean).join(' · ') || 'No brand / category'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {product.is_serialized && (
            <button
              onClick={() => {
                setSerialVariantId(activeVariants[0]?.id)
                setShowSerialModal(true)
              }}
              className="btn-secondary flex items-center gap-2 text-purple-700 border-purple-200 hover:bg-purple-50 shadow-2xs"
            >
              <Barcode size={15} /> Serials & Barcode
            </button>
          )}
          {canAdjust && (
            <button
              onClick={() => {
                setSelectedVariantId(activeVariants[0]?.id)
                setShowAdjustModal(true)
              }}
              className="btn-secondary flex items-center gap-2"
            >
              <SlidersHorizontal size={15} /> Adjust Stock
            </button>
          )}
          {canAdjust && (product.total_stock ?? 0) > 0 && (
            <button
              onClick={() => {
                setClearTargetVariant(null)
                setShowClearModal(true)
              }}
              className="btn-secondary flex items-center gap-2 text-red-700 border-red-200 hover:bg-red-50"
              title="Clear all stock to 0"
            >
              <Trash2 size={15} /> Clear Stock
            </button>
          )}
          {canEdit && (
            <button onClick={() => setShowEdit(true)} className="btn-secondary flex items-center gap-2">
              <Pencil size={15} /> Edit
            </button>
          )}
        </div>
      </div>

      {/* Description */}
      {product.description && (
        <div className="card">
          <p className="text-sm text-gray-600">{product.description}</p>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Stock',   value: (product.total_stock ?? 0) <= 0 ? 'Stock Out' : product.total_stock, icon: Package, color: (product.total_stock ?? 0) <= 0 ? 'text-red-600' : 'text-blue-600', bg: (product.total_stock ?? 0) <= 0 ? 'bg-red-50' : 'bg-blue-50' },
          { label: 'Variants',      value: activeVariants.length, icon: Barcode,    color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Min Price',     value: formatCurrency(Math.min(...activeVariants.map(v => Number(v.selling_price)))), icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Max Warranty',  value: `${Math.max(...activeVariants.map(v => v.warranty_months), 0)} mo`, icon: Shield, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(stat => (
          <div key={stat.label} className="card flex items-center gap-3 p-4">
            <div className={`${stat.bg} p-2.5 rounded-xl flex-shrink-0`}>
              <stat.icon size={18} className={stat.color} />
            </div>
            <div>
              <p className="text-lg font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          2-SEGMENT SERIALIZED PRODUCT OVERVIEW (If Serialized)
          ════════════════════════════════════════════════════════════════════ */}
      {product.is_serialized && (
        <div className="card border-purple-200 bg-gradient-to-br from-purple-50/30 via-white to-blue-50/20 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                <Barcode size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">2-Segment Serialized Configuration</h3>
                <p className="text-xs text-gray-500">
                  Segment 1 = Product Barcode & SKU · Segment 2 = Individual Unit Serial Numbers (S/N)
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setSerialVariantId(activeVariants[0]?.id)
                setShowSerialModal(true)
              }}
              className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 border-purple-200 text-purple-700 hover:bg-purple-50 font-medium"
            >
              <Pencil size={13} /> Manage / Edit Serials & Barcode
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            {/* Segment 1 Box */}
            <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold">1</span>
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wide">Segment 1: Barcode & SKU</span>
              </div>
              <div className="space-y-1 text-xs">
                {activeVariants.map(v => (
                  <div key={v.id} className="flex justify-between items-center py-1 border-b border-blue-100 last:border-none">
                    <span className="text-gray-600">{v.name}:</span>
                    <span className="font-mono text-gray-900 font-medium">
                      {v.barcode ? `Barcode: ${v.barcode}` : 'No barcode'}
                      {v.sku ? ` · SKU: ${v.sku}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Segment 2 Box */}
            <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 space-y-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-white text-[11px] font-bold">2</span>
                <span className="text-xs font-bold text-purple-900 uppercase tracking-wide">Segment 2: Serial Numbers</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-gray-600">Total in stock serials:</span>
                <span className="font-bold text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-full">
                  {product.total_stock ?? 0} units registered
                </span>
              </div>
              <p className="text-[11px] text-gray-500">
                You can edit, add, or scan serial numbers at any time using the Serial Manager.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Variants table */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Variants</h3>
          {canEdit && (
            <button
              onClick={() => setShowEdit(true)}
              className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <Plus size={13} /> Add Variant
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 font-medium text-gray-600">Variant</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">SKU</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Cost</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Price</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Margin</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Stock</th>
                <th className="text-left px-5 py-3 font-medium text-gray-600">Warranty</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {product.variants.map(v => (
                <tr key={v.id} className={`${v.is_active ? '' : 'opacity-50'}`}>
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{v.name}</p>
                    {v.barcode && <p className="text-xs text-gray-400 font-mono">Barcode: {v.barcode}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 font-mono text-xs">{v.sku || '—'}</td>
                  <td className="px-5 py-3.5 text-gray-700">{formatCurrency(v.cost_price)}</td>
                  <td className="px-5 py-3.5 font-semibold text-gray-900">{formatCurrency(v.selling_price)}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-green-600 text-xs font-medium">
                      {profitMargin(Number(v.cost_price), Number(v.selling_price))}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    {v.current_stock <= 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700">
                        Stock Out
                      </span>
                    ) : (
                      <>
                        <span className={`font-semibold ${v.current_stock <= v.reorder_level ? 'text-red-500' : 'text-gray-900'}`}>
                          {v.current_stock}
                        </span>
                        {v.current_stock <= v.reorder_level && (
                          <AlertTriangle size={12} className="inline ml-1 text-amber-500" />
                        )}
                      </>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {v.warranty_months ? `${v.warranty_months} mo` : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 justify-end">
                      {product.is_serialized && (
                        <button
                          onClick={() => {
                            setSerialVariantId(v.id)
                            setShowSerialModal(true)
                          }}
                          className="p-1.5 rounded text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                          title="Manage Barcode, SKU & Serials"
                        >
                          <Barcode size={14} />
                        </button>
                      )}
                      {canAdjust && (
                        <button
                          onClick={() => {
                            setSelectedVariantId(v.id)
                            setShowAdjustModal(true)
                          }}
                          className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Adjust stock"
                        >
                          <SlidersHorizontal size={14} />
                        </button>
                      )}
                      {canAdjust && v.current_stock > 0 && (
                        <button
                          onClick={() => {
                            setClearTargetVariant(v)
                            setShowClearModal(true)
                          }}
                          className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Clear stock to 0"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => openPriceHistory(v)}
                        className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                        title="Price history"
                      >
                        <History size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit modal */}
      <ProductFormModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        onSaved={fetchProduct}
        editProduct={product}
        categories={categories}
        brands={brands}
      />

      {/* Price History modal */}
      <Modal
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        title={`Price History — ${historyVariant?.name}`}
        maxWidth="md"
      >
        {priceHistory.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">No price changes recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {priceHistory.map(h => (
              <div key={h.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">{formatDateTime(h.changed_at)}</span>
                  {h.reason && <span className="text-xs text-gray-500 italic">{h.reason}</span>}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {h.old_sell_price !== null && (
                    <>
                      <div>
                        <p className="text-xs text-gray-400">Sell Price</p>
                        <p className="text-gray-500 line-through">{formatCurrency(h.old_sell_price!)}</p>
                        <p className="font-semibold text-gray-900">{formatCurrency(h.new_sell_price!)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Cost Price</p>
                        <p className="text-gray-500 line-through">{formatCurrency(h.old_cost_price!)}</p>
                        <p className="font-semibold text-gray-900">{formatCurrency(h.new_cost_price!)}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Stock Adjustment modal */}
      <StockAdjustmentModal
        isOpen={showAdjustModal}
        onClose={() => {
          setShowAdjustModal(false)
          setSelectedVariantId(undefined)
        }}
        onSaved={fetchProduct}
        initialVariantId={selectedVariantId}
      />

      {/* Clear Stock Modal */}
      <ClearStockModal
        isOpen={showClearModal}
        onClose={() => {
          setShowClearModal(false)
          setClearTargetVariant(null)
        }}
        onCleared={fetchProduct}
        productId={product.id}
        productName={product.name}
        variantId={clearTargetVariant?.id}
        variantName={clearTargetVariant?.name}
        currentStock={clearTargetVariant ? clearTargetVariant.current_stock : (product.total_stock ?? 0)}
      />

      {/* 2-Segment Serial & Barcode Manager Modal */}
      {showSerialModal && (
        <SerialManagerModal
          isOpen={showSerialModal}
          onClose={() => setShowSerialModal(false)}
          product={product}
          initialVariantId={serialVariantId}
          onSaved={fetchProduct}
        />
      )}
    </div>
  )
}

