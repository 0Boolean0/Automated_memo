/**
 * Custom hook for product list state: pagination, search, filters.
 */

import { useEffect, useState, useCallback } from 'react'
import { productService, categoryService, brandService } from '@/services/productService'
import type { Product, Category, Brand, PaginatedProducts } from '@/services/productService'
import toast from 'react-hot-toast'

export function useProducts() {
  const [data, setData]         = useState<PaginatedProducts | null>(null)
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [brandId, setBrandId]   = useState<number | undefined>()
  const [page, setPage]         = useState(1)
  const [categories, setCategories] = useState<Category[]>([])
  const [brands, setBrands]     = useState<Brand[]>([])

  // Load filter options once
  useEffect(() => {
    Promise.all([categoryService.list(), brandService.list()]).then(([cats, brds]) => {
      setCategories(cats.filter(c => c.is_active))
      setBrands(brds.filter(b => b.is_active))
    })
  }, [])

  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const result = await productService.list({
        search: search || undefined,
        category_id: categoryId,
        brand_id: brandId,
        page,
        per_page: 20,
      })
      setData(result)
    } catch {
      toast.error('Failed to load products')
    } finally {
      setLoading(false)
    }
  }, [search, categoryId, brandId, page])

  useEffect(() => { setPage(1) }, [search, categoryId, brandId])
  useEffect(() => { fetch() }, [fetch])

  return {
    data, loading, search, setSearch,
    categoryId, setCategoryId,
    brandId, setBrandId,
    page, setPage,
    categories, brands,
    refetch: fetch,
  }
}
