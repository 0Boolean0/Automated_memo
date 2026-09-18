"""Return Pydantic schemas — Phase 11."""

from pydantic import BaseModel, field_validator
from typing import Optional
from decimal import Decimal
from datetime import date, datetime


class ReturnItemCreate(BaseModel):
    variant_id: int
    serial_id:  Optional[int] = None   # required for serialized products
    quantity:   int = 1
    condition:  str = "GOOD"           # GOOD | DAMAGED
    notes:      Optional[str] = None

    @field_validator("condition")
    @classmethod
    def valid_condition(cls, v: str) -> str:
        v = v.upper()
        if v not in ("GOOD", "DAMAGED"):
            raise ValueError("condition must be GOOD or DAMAGED")
        return v

    @field_validator("quantity")
    @classmethod
    def positive(cls, v: int) -> int:
        if v < 1:
            raise ValueError("quantity must be at least 1")
        return v


class ReturnCreate(BaseModel):
    sale_id:       Optional[int]   = None
    customer_id:   Optional[int]   = None
    return_date:   date
    reason:        str
    return_type:   str             = "CUSTOMER_RETURN"
    refund_amount: Decimal         = Decimal("0")
    refund_status: str             = "PENDING"
    notes:         Optional[str]   = None
    items:         list[ReturnItemCreate]

    @field_validator("reason")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Reason is required")
        return v

    @field_validator("items")
    @classmethod
    def at_least_one(cls, v: list) -> list:
        if not v:
            raise ValueError("At least one item is required")
        return v


class ReturnItemResponse(BaseModel):
    id:           int
    variant_id:   int
    variant_name: Optional[str] = None
    product_name: Optional[str] = None
    sku:          Optional[str] = None
    serial_id:    Optional[int] = None
    serial_number:Optional[str] = None
    quantity:     int
    condition:    str
    notes:        Optional[str] = None
    model_config = {"from_attributes": True}


class ReturnResponse(BaseModel):
    id:             int
    business_id:    int
    sale_id:        Optional[int]   = None
    sale_number:    Optional[str]   = None
    customer_id:    Optional[int]   = None
    customer_name:  Optional[str]   = None
    return_number:  str
    return_date:    date
    reason:         str
    return_type:    str
    refund_amount:  Decimal
    refund_status:  str
    notes:          Optional[str]   = None
    created_at:     datetime
    items:          list[ReturnItemResponse] = []
    model_config = {"from_attributes": True}


class ReturnListResponse(BaseModel):
    id:            int
    return_number: str
    sale_number:   Optional[str] = None
    customer_name: Optional[str] = None
    return_date:   date
    return_type:   str
    refund_amount: Decimal
    refund_status: str
    item_count:    int = 0
    created_at:    datetime
    model_config = {"from_attributes": True}


class RefundStatusUpdate(BaseModel):
    refund_status: str

    @field_validator("refund_status")
    @classmethod
    def valid(cls, v: str) -> str:
        if v not in ("PENDING", "ISSUED", "EXCHANGE", "NONE"):
            raise ValueError("Invalid refund_status")
        return v
