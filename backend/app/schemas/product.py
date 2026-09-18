"""
Product-related Pydantic schemas.
"""

from pydantic import BaseModel, field_validator
from typing import Optional, Any
from decimal import Decimal
from datetime import datetime


# ─── Category ────────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None
    description: Optional[str] = None

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class CategoryResponse(BaseModel):
    id: int
    business_id: int
    name: str
    parent_id: Optional[int] = None
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── Brand ───────────────────────────────────────────────────────────────────

class BrandCreate(BaseModel):
    name: str
    description: Optional[str] = None

class BrandUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class BrandResponse(BaseModel):
    id: int
    business_id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    model_config = {"from_attributes": True}


# ─── ProductVariant ───────────────────────────────────────────────────────────

class VariantCreate(BaseModel):
    name: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    cost_price: Decimal = Decimal("0")
    selling_price: Decimal = Decimal("0")
    warranty_months: int = 0
    reorder_level: int = 5
    other_specs: Optional[dict[str, Any]] = None

    @field_validator("cost_price", "selling_price")
    @classmethod
    def non_negative(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Price cannot be negative")
        return v

class VariantUpdate(BaseModel):
    name: Optional[str] = None
    sku: Optional[str] = None
    barcode: Optional[str] = None
    cost_price: Optional[Decimal] = None
    selling_price: Optional[Decimal] = None
    warranty_months: Optional[int] = None
    reorder_level: Optional[int] = None
    other_specs: Optional[dict[str, Any]] = None
    is_active: Optional[bool] = None

class PriceHistoryResponse(BaseModel):
    id: int
    old_cost_price: Optional[Decimal] = None
    new_cost_price: Optional[Decimal] = None
    old_sell_price: Optional[Decimal] = None
    new_sell_price: Optional[Decimal] = None
    reason: Optional[str] = None
    changed_at: str
    model_config = {"from_attributes": True}

class VariantResponse(BaseModel):
    id: int
    product_id: int
    name: str
    sku: Optional[str] = None
    barcode: Optional[str] = None
    cost_price: Decimal
    selling_price: Decimal
    warranty_months: int
    reorder_level: int
    current_stock: int
    other_specs: Optional[dict[str, Any]] = None
    is_active: bool
    created_at: datetime
    # computed: count of IN_STOCK serials (set by service layer)
    in_stock_serials: int = 0
    model_config = {"from_attributes": True}


# ─── Product ──────────────────────────────────────────────────────────────────

class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    brand_id: Optional[int] = None
    category_id: Optional[int] = None
    is_serialized: bool = True
    # At least one variant is required when creating a product
    variants: list[VariantCreate]

    @field_validator("variants")
    @classmethod
    def at_least_one_variant(cls, v: list) -> list:
        if not v:
            raise ValueError("A product must have at least one variant")
        return v

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    brand_id: Optional[int] = None
    category_id: Optional[int] = None
    is_active: Optional[bool] = None

class ProductResponse(BaseModel):
    id: int
    business_id: int
    name: str
    description: Optional[str] = None
    brand_id: Optional[int] = None
    category_id: Optional[int] = None
    is_serialized: bool
    is_active: bool
    created_at: datetime
    total_stock: int = 0
    # Resolved names (joined by service)
    brand_name: Optional[str] = None
    category_name: Optional[str] = None
    variants: list[VariantResponse] = []
    model_config = {"from_attributes": True}

class ProductListResponse(BaseModel):
    """Product summary for list views — includes active variants."""
    id: int
    name: str
    is_serialized: bool
    is_active: bool
    brand_name: Optional[str] = None
    category_name: Optional[str] = None
    total_stock: int = 0
    variant_count: int = 0
    created_at: datetime
    variants: list[VariantResponse] = []
    model_config = {"from_attributes": True}


# ─── Paginated wrapper ────────────────────────────────────────────────────────

class PaginatedProducts(BaseModel):
    items: list[ProductListResponse]
    total: int
    page: int
    per_page: int
    pages: int
