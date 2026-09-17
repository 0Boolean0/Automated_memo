"""Purchase Pydantic schemas."""

from pydantic import BaseModel, field_validator
from typing import Optional
from decimal import Decimal
from datetime import date, datetime


class SerialInput(BaseModel):
    """One serial number being received."""
    serial: str
    notes: Optional[str] = None

    @field_validator("serial")
    @classmethod
    def clean(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Serial number cannot be empty")
        return v


class PurchaseItemCreate(BaseModel):
    variant_id: int
    quantity: int
    unit_cost: Decimal
    notes: Optional[str] = None
    # For serialized products, serials must be provided and count must match quantity
    serials: list[SerialInput] = []

    @field_validator("quantity")
    @classmethod
    def positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("Quantity must be at least 1")
        return v


class PurchaseCreate(BaseModel):
    supplier_id: Optional[int] = None
    invoice_number: Optional[str] = None
    purchase_date: date
    paid_amount: Decimal = Decimal("0")
    notes: Optional[str] = None
    items: list[PurchaseItemCreate]

    @field_validator("items")
    @classmethod
    def at_least_one(cls, v: list) -> list:
        if not v:
            raise ValueError("A purchase must have at least one item")
        return v


class PurchaseItemResponse(BaseModel):
    id: int
    variant_id: int
    variant_name: Optional[str] = None
    product_name: Optional[str] = None
    sku: Optional[str] = None
    quantity: int
    unit_cost: Decimal
    total_cost: Decimal
    notes: Optional[str] = None
    serial_count: int = 0
    model_config = {"from_attributes": True}


class PurchaseResponse(BaseModel):
    id: int
    business_id: int
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    purchase_number: str
    invoice_number: Optional[str] = None
    purchase_date: date
    total_amount: Decimal
    paid_amount: Decimal
    due_amount: float = 0
    payment_status: str
    notes: Optional[str] = None
    created_at: datetime
    items: list[PurchaseItemResponse] = []
    model_config = {"from_attributes": True}


class PurchaseListResponse(BaseModel):
    id: int
    purchase_number: str
    supplier_name: Optional[str] = None
    purchase_date: date
    total_amount: Decimal
    paid_amount: Decimal
    payment_status: str
    item_count: int = 0
    created_at: datetime
    model_config = {"from_attributes": True}


class PaginatedPurchases(BaseModel):
    items: list[PurchaseListResponse]
    total: int
    page: int
    per_page: int
    pages: int
