"""Inventory Pydantic schemas — Phase 5."""

from pydantic import BaseModel, field_validator
from typing import Optional
from decimal import Decimal
from datetime import datetime


class AdjustmentCreate(BaseModel):
    """Input for creating an inventory adjustment."""
    variant_id: int
    adjustment_type: str  # One of: PHYSICAL_COUNT, DAMAGE, LOSS, TRANSFER, RETURN, CORRECTION
    quantity_change: int  # Can be positive or negative
    reason: str  # Required explanation
    notes: Optional[str] = None

    @field_validator("quantity_change")
    @classmethod
    def non_zero(cls, v: int) -> int:
        if v == 0:
            raise ValueError("Quantity change must be non-zero")
        return v

    @field_validator("reason")
    @classmethod
    def reason_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Reason is required")
        return v


class AdjustmentResponse(BaseModel):
    """Response for an inventory adjustment."""
    id: int
    business_id: int
    variant_id: int
    variant_name: Optional[str] = None
    product_name: Optional[str] = None
    sku: Optional[str] = None
    adjustment_type: str
    quantity_change: int
    reason: str
    adjusted_by_user_id: Optional[int] = None
    adjusted_by_username: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LowStockAlertResponse(BaseModel):
    """Response for a low-stock alert."""
    id: int
    variant_id: int
    variant_name: str
    product_id: int
    product_name: Optional[str] = None
    sku: Optional[str] = None
    current_stock: int
    reorder_level: int
    shortage: int  # How many units below reorder level
    cost_price: Decimal
    selling_price: Decimal

    model_config = {"from_attributes": True}
