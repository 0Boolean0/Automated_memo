/**
 * Products list page — search, filter by category/brand, paginated.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Search, Boxes, ChevronLeft, ChevronRight,
  Loader2, Package, SlidersHorizontal,
} from 'lucide-react'
import Badge from '@/components/ui/Badge'
import ProductFormModal from '@/components/products/ProductFormModal'
import StockAdjustmentModal from '@/components/inventory/StockAdjustmentModal'
import { useProducts } from '@/hooks/useProducts'
import { useAuthStore } from '@/services/authStore'
import type { Product } from '@/services/productService'

export default function ProductsPage() {
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const canCreate = hasPermission('create_product')
  const canAdjust = hasPermission('adjust_inventory')

  const {
    data, loading, search, setSearch,
    categoryId, setCategoryId,
    brandId, setBrandId,
    page, setPage,
    categories, brands,
    refetch,
  } = useProducts()

  const [showCreate, setShowCreate] = useState(false)
  const [stockFilter, setStockFilter] = useState<'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK'>('ALL')
  const [showAdjustment, setShowAdjustment] = useState(false)
  const [selectedVariantId, setSelectedVariantId] = useState<number | undefined>(undefined)

  const rawProducts = data?.items ?? []
  const products = rawProducts.filter(p => {
    if (stockFilter === 'IN_STOCK') return (p.total_stock ?? 0) > 0
    if (stockFilter === 'OUT_OF_STOCK') return (p.total_stock ?? 0) === 0
    return true
  })

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Products</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {data ? `${data.total} products` : '…'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canAdjust && (
            <button
              className="btn-secondary flex items-center gap-2"
              onClick={() => {
                setSelectedVariantId(undefined)
                setShowAdjustment(true)
              }}
            >
              <SlidersHorizontal size={16} /> Adjust Stock
            </button>
          )}
          {canCreate && (
            <button className="btn-primary flex items-center gap-2" onClick={() => setShowCreate(true)}>
              <Plus size={16} /> New Product
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search products…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select
          className="input w-auto min-w-[150px]"
          value={categoryId ?? ''}
          onChange={e => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select
          className="input w-auto min-w-[150px]"
          value={brandId ?? ''}
          onChange={e => setBrandId(e.target.value ? Number(e.target.value) : undefined)}
        >
          <option value="">All Brands</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <select
          className="input w-auto min-w-[150px]"
          value={stockFilter}
          onChange={e => setStockFilter(e.target.value as 'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK')}
        >
          <option value="ALL">All Stock Levels</option>
          <option value="IN_STOCK">In Stock (&gt; 0)</option>
          <option value="OUT_OF_STOCK">Out of Stock (0)</option>
        </select>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-primary-500" />
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package size={40} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">No products found</p>
            {canCreate && (
              <button onClick={() => setShowCreate(true)} className="mt-3 text-sm text-primary-600 hover:underline">
                Create your first product
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Product</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Category / Brand</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Variants</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Stock</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Type</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                    <th className="text-right px-5 py-3 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {products.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/products/${p.id}`)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center text-primary-500 flex-shrink-0">
                            <Boxes size={18} />
                          </div>
                          <span className="font-medium text-gray-900">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">
                        <p className="text-xs">{p.category_name ?? '—'}</p>
                        <p className="text-xs text-gray-400">{p.brand_name ?? '—'}</p>
                      </td>
                      <td className="px-5 py-3.5 text-gray-700">{p.variant_count ?? 0}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${(p.total_stock ?? 0) <= 0 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {(p.total_stock ?? 0) <= 0 ? 'Stock Out' : `${p.total_stock} in stock`}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={p.is_serialized ? 'blue' : 'gray'}>
                          {p.is_serialized ? 'Serialized' : 'Qty'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={p.is_active ? 'green' : 'gray'}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {canAdjust && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedVariantId(p.variants?.[0]?.id)
                                setShowAdjustment(true)
                              }}
                              className="px-2.5 py-1 rounded text-xs font-medium text-gray-700 bg-gray-100 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-1"
                              title="Adjust Stock"
                            >
                              <SlidersHorizontal size={13} /> Adjust Stock
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data && data.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500">
                  Page {data.page} of {data.pages} — {data.total} total
                </p>
                <div className="flex gap-2">
                  <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="btn-secondary py-1 px-2 disabled:opacity-40"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    disabled={page >= data.pages}
                    onClick={() => setPage(p => p + 1)}
                    className="btn-secondary py-1 px-2 disabled:opacity-40"
                  >
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create modal */}
      <ProductFormModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={refetch}
        categories={categories}
        brands={brands}
      />

      {/* Stock Adjustment modal */}
      <StockAdjustmentModal
        isOpen={showAdjustment}
        onClose={() => {
          setShowAdjustment(false)
          setSelectedVariantId(undefined)
        }}
        onSaved={refetch}
        initialVariantId={selectedVariantId}
      />
    </div>
  )
}
