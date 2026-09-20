/**
 * Product catalog API service layer.
 * All HTTP calls for categories, brands, products, variants go through here.
 */

import api from '@/services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Category {
  id: number
  business_id: number
  name: string
  parent_id: number | null
  description: string | null
  is_active: boolean
  created_at: string
}

export interface Brand {
  id: number
  business_id: number
  name: string
  description: string | null
  is_active: boolean
  created_at: string
}

export interface PriceHistory {
  id: number
  old_cost_price: number | null
  new_cost_price: number | null
  old_sell_price: number | null
  new_sell_price: number | null
  reason: string | null
  changed_at: string
}

export interface ProductVariant {
  id: number
  product_id: number
  name: string
  sku: string | null
  barcode: string | null
  cost_price: number
  selling_price: number
  warranty_months: number
  reorder_level: number
  current_stock: number
  in_stock_serials: number
  other_specs: Record<string, string> | null
  is_active: boolean
  created_at: string
}

export interface Product {
  id: number
  business_id: number
  name: string
  description: string | null
  brand_id: number | null
  brand_name: string | null
  category_id: number | null
  category_name: string | null
  is_serialized: boolean
  is_active: boolean
  total_stock: number
  variant_count?: number
  variants: ProductVariant[]
  created_at: string
}

export interface PaginatedProducts {
  items: Product[]
  total: number
  page: number
  per_page: number
  pages: number
}

/** Phase 6: Result from GET /products/scan */
export interface ScanResult {
  variant_id: number
  variant_name: string
  sku: string | null
  barcode: string | null
  product_id: number
  product_name: string
  is_serialized: boolean
  brand_name: string | null
  category_name: string | null
  cost_price: number
  selling_price: number
  current_stock: number
  reorder_level: number
  in_stock_serials: number | null
  is_low_stock: boolean
  warranty_months: number
  matched_serial?: string | null
}

export interface InStockVariantItem {
  id: number
  product_id: number
  name: string
  sku: string | null
  barcode: string | null
  selling_price: number
  cost_price: number
  warranty_months: number
  current_stock: number
  available_serials: string[]
}

export interface InStockProductItem {
  id: number
  name: string
  brand_name: string | null
  category_name: string | null
  is_serialized: boolean
  total_stock: number
  variants: InStockVariantItem[]
}

export interface QuickLookupResult {
  match_type: 'serial' | 'barcode' | 'sku' | 'name'
  matched_serial: string | null
  product_id: number
  product_name: string
  is_serialized: boolean
  variant_id: number
  variant_name: string
  sku: string | null
  barcode: string | null
  selling_price: number
  current_stock: number
  warranty_months: number
  available_serials: string[]
}

export interface ScanImageResponse {
  found: boolean
  raw_text: string
  detected_code: string | null
  match: QuickLookupResult | null
  message: string | null
}

export interface ExtractedLabelData {
  raw_text: string
  barcode?: string | null
  sku?: string | null
  serials: string[]
  all_candidates: string[]
  lines: string[]
  message?: string | null
}

export interface ProductListParams {
  search?: string
  category_id?: number
  brand_id?: number
  is_active?: boolean
  page?: number
  per_page?: number
}

export interface CreateVariantPayload {
  name: string
  sku?: string
  barcode?: string
  cost_price: number
  selling_price: number
  warranty_months: number
  reorder_level: number
  initial_stock?: number
  initial_serials?: string[]
  other_specs?: Record<string, string>
}

export interface CreateProductPayload {
  name: string
  description?: string
  brand_id?: number | null
  category_id?: number | null
  is_serialized: boolean
  variants: CreateVariantPayload[]
}

export interface UpdateProductPayload {
  name?: string
  description?: string
  brand_id?: number | null
  category_id?: number | null
  is_active?: boolean
}

export interface UpdateVariantPayload {
  name?: string
  sku?: string
  barcode?: string
  cost_price?: number
  selling_price?: number
  warranty_months?: number
  reorder_level?: number
  current_stock?: number
  other_specs?: Record<string, string>
  is_active?: boolean
}

// ─── Categories ───────────────────────────────────────────────────────────────

export const categoryService = {
  list: () => api.get<Category[]>('/categories').then(r => r.data),
  create: (payload: { name: string; description?: string; parent_id?: number }) =>
    api.post<Category>('/categories', payload).then(r => r.data),
  update: (id: number, payload: Partial<{ name: string; description: string; is_active: boolean }>) =>
    api.put<Category>(`/categories/${id}`, payload).then(r => r.data),
  delete: (id: number) => api.delete(`/categories/${id}`),
}

// ─── Brands ───────────────────────────────────────────────────────────────────

export const brandService = {
  list: () => api.get<Brand[]>('/brands').then(r => r.data),
  create: (payload: { name: string; description?: string }) =>
    api.post<Brand>('/brands', payload).then(r => r.data),
  update: (id: number, payload: Partial<{ name: string; description: string; is_active: boolean }>) =>
    api.put<Brand>(`/brands/${id}`, payload).then(r => r.data),
  delete: (id: number) => api.delete(`/brands/${id}`),
}

// ─── Products ─────────────────────────────────────────────────────────────────

export const productService = {
  list: (params: ProductListParams = {}) =>
    api.get<PaginatedProducts>('/products/', { params }).then(r => r.data),

  get: (id: number) =>
    api.get<Product>(`/products/${id}`).then(r => r.data),

  create: (payload: CreateProductPayload) =>
    api.post<Product>('/products/', payload).then(r => r.data),

  update: (id: number, payload: UpdateProductPayload) =>
    api.put<Product>(`/products/${id}`, payload).then(r => r.data),

  delete: (id: number) => api.delete(`/products/${id}`),

  addVariant: (productId: number, payload: CreateVariantPayload) =>
    api.post<ProductVariant>(`/products/${productId}/variants`, payload).then(r => r.data),

  updateVariant: (variantId: number, payload: UpdateVariantPayload) =>
    api.put<ProductVariant>(`/products/variants/${variantId}`, payload).then(r => r.data),

  getPriceHistory: (variantId: number) =>
    api.get<PriceHistory[]>(`/products/variants/${variantId}/price-history`).then(r => r.data),

  /** Look up a variant by barcode, SKU, or serial number. */
  scan: (params: { barcode?: string; sku?: string; serial?: string }) =>
    api.get<ScanResult>('/products/scan', { params }).then(r => r.data),

  /** Get available in-stock serial numbers for a variant. */
  getInStockSerials: (variantId: number) =>
    api.get<string[]>(`/products/variants/${variantId}/serials/in-stock`).then(r => r.data),

  /** Get all active products and variants in stock with their serial numbers. */
  getInStockCatalog: () =>
    api.get<InStockProductItem[]>('/products/in-stock-catalog').then(r => r.data),

  /** Quick search across serials, barcodes, SKUs, and names. */
  quickLookup: (q: string) =>
    api.get<QuickLookupResult[]>('/products/quick-lookup', { params: { q } }).then(r => r.data),

  /** Upload an image (photo of barcode/serial sticker) for automatic detection. */
  scanImage: (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<ScanImageResponse>('/products/scan-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },

  /** Upload an image of a box/label to extract Barcode, SKU, and Serial numbers. */
  extractLabelCodes: (file: File | Blob) => {
    const formData = new FormData()
    formData.append('file', file)
    return api.post<ExtractedLabelData>('/products/extract-label-codes', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data)
  },
}
