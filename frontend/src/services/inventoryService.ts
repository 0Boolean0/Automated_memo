/**
 * Inventory service — Phase 5.
 *
 * API calls for:
 * - Creating stock adjustments
 * - Fetching adjustment history
 * - Fetching low-stock alerts
 *
 * Usage:
 *   import inventoryService from '@/services/inventoryService'
 *   const response = await inventoryService.createAdjustment(data)
 *   const alerts = await inventoryService.getLowStockAlerts()
 */

import api from '@/services/api'

export interface AdjustmentCreate {
  variant_id: number
  adjustment_type: string // PHYSICAL_COUNT, DAMAGE, LOSS, TRANSFER, RETURN, CORRECTION
  quantity_change: number
  reason: string
  notes?: string
}

export interface AdjustmentResponse {
  id: number
  business_id: number
  variant_id: number
  variant_name?: string
  product_name?: string
  sku?: string
  adjustment_type: string
  quantity_change: number
  reason: string
  adjusted_by_user_id?: number
  adjusted_by_username?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface LowStockAlert {
  id: number
  variant_id: number
  variant_name: string
  product_id: number
  product_name?: string
  sku?: string
  current_stock: number
  reorder_level: number
  shortage: number
  cost_price: number
  selling_price: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  pages: number
}

const inventoryService = {
  /**
   * Create a stock adjustment.
   *
   * @param data Adjustment data (variant_id, type, quantity, reason, optional notes)
   * @returns Created adjustment record
   */
  async createAdjustment(data: AdjustmentCreate): Promise<AdjustmentResponse> {
    const { data: response } = await api.post<AdjustmentResponse>('/adjustments', data)
    return response
  },

  /**
   * Get paginated list of adjustments.
   *
   * @param params Query parameters (variant_id, adjustment_type, page, per_page)
   * @returns Paginated adjustment list
   */
  async listAdjustments(params?: {
    variant_id?: number
    adjustment_type?: string
    page?: number
    per_page?: number
  }): Promise<PaginatedResponse<AdjustmentResponse>> {
    const { data } = await api.get<PaginatedResponse<AdjustmentResponse>>(
      '/adjustments',
      { params }
    )
    return data
  },

  /**
   * Get a single adjustment by ID.
   *
   * @param id Adjustment ID
   * @returns Adjustment record
   */
  async getAdjustment(id: number): Promise<AdjustmentResponse> {
    const { data } = await api.get<AdjustmentResponse>(`/adjustments/${id}`)
    return data
  },

  /**
   * Get paginated list of low-stock alerts.
   *
   * Variants with current_stock < reorder_level, sorted by urgency.
   *
   * @param params Query parameters (page, per_page)
   * @returns Paginated low-stock alert list
   */
  async getLowStockAlerts(params?: {
    page?: number
    per_page?: number
  }): Promise<PaginatedResponse<LowStockAlert>> {
    const { data } = await api.get<PaginatedResponse<LowStockAlert>>(
      '/adjustments/alerts/low-stock',
      { params }
    )
    return data
  },
}

export default inventoryService
