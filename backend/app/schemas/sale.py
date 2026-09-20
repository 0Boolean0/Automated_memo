"""Sale Pydantic schemas — Phase 8."""

from pydantic import BaseModel, field_validator
from typing import Optional
from decimal import Decimal
from datetime import date, datetime


# ─── Input schemas ────────────────────────────────────────────────────────────

class SerialSaleInput(BaseModel):
    """One serial number being sold (must already exist as IN_STOCK)."""
    serial: str

    @field_validator("serial")
    @classmethod
    def clean(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Serial number cannot be empty")
        return v


class SaleItemCreate(BaseModel):
    variant_id:      int
    quantity:        int
    unit_price:      Optional[Decimal] = None   # None = use variant.selling_price
    discount_amount: Decimal = Decimal("0")
    serials:         list[SerialSaleInput] = []  # required for serialized products
    warranty_period: Optional[str] = None       # e.g. "1 Year", "2 Years", "7 Days", "No Warranty"
    warranty_months: Optional[int] = None       # e.g. 12, 24, 0
    notes:           Optional[str] = None

    @field_validator("quantity")
    @classmethod
    def positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Quantity must be at least 1")
        return v


class SaleCreate(BaseModel):
    customer_id:             Optional[int] = None
    sale_date:               date
    paid_amount:             Decimal = Decimal("0")
    discount_amount:         Decimal = Decimal("0")
    loyalty_points_redeemed: int = 0
    notes:                   Optional[str] = None
    items:                   list[SaleItemCreate]

    @field_validator("items")
    @classmethod
    def at_least_one(cls, v: list) -> list:
        if not v:
            raise ValueError("A sale must have at least one item")
        return v

    @field_validator("loyalty_points_redeemed")
    @classmethod
    def non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("loyalty_points_redeemed cannot be negative")
        return v


# ─── Response schemas ─────────────────────────────────────────────────────────

class SaleItemResponse(BaseModel):
    id:              int
    variant_id:      int
    variant_name:    Optional[str] = None
    product_name:    Optional[str] = None
    sku:             Optional[str] = None
    quantity:        int
    unit_price:      Decimal
    discount_amount: Decimal
    total_price:     Decimal
    warranty_period: Optional[str] = None
    warranty_months: Optional[int] = None
    notes:           Optional[str] = None
    serial_count:    int = 0
    model_config = {"from_attributes": True}


class SaleResponse(BaseModel):
    id:                      int
    business_id:             int
    customer_id:             Optional[int] = None
    customer_name:           Optional[str] = None
    customer_phone:          Optional[str] = None
    sale_number:             str
    sale_date:               date
    total_amount:            Decimal
    discount_amount:         Decimal
    loyalty_points_redeemed: int
    loyalty_points_earned:   int
    paid_amount:             Decimal
    net_payable:             float
    due_amount:              float
    payment_status:          str
    notes:                   Optional[str] = None
    created_at:              datetime
    items:                   list[SaleItemResponse] = []
    model_config = {"from_attributes": True}


class SaleListResponse(BaseModel):
    id:            int
    sale_number:   str
    customer_name: Optional[str] = None
    sale_date:     date
    total_amount:  Decimal
    paid_amount:   Decimal
    net_payable:   float
    due_amount:    float
    payment_status: str
    item_count:    int = 0
    created_at:    datetime
    model_config = {"from_attributes": True}


class PaginatedSales(BaseModel):
    items:    list[SaleListResponse]
    total:    int
    page:     int
    per_page: int
    pages:    int
