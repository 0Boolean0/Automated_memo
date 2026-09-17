"""Customer Pydantic schemas — Phase 7."""

from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


class CustomerCreate(BaseModel):
    name:           str
    phone:          Optional[str] = None
    email:          Optional[str] = None
    address:        Optional[str] = None
    customer_type:  str = "RETAIL"   # RETAIL | WHOLESALE
    notes:          Optional[str] = None

    @field_validator("customer_type")
    @classmethod
    def valid_type(cls, v: str) -> str:
        v = v.upper()
        if v not in ("RETAIL", "WHOLESALE"):
            raise ValueError("customer_type must be RETAIL or WHOLESALE")
        return v

    @field_validator("name")
    @classmethod
    def name_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        return v


class CustomerUpdate(BaseModel):
    name:           Optional[str] = None
    phone:          Optional[str] = None
    email:          Optional[str] = None
    address:        Optional[str] = None
    customer_type:  Optional[str] = None
    notes:          Optional[str] = None
    is_active:      Optional[bool] = None
    loyalty_points: Optional[int] = None


class CustomerResponse(BaseModel):
    id:             int
    business_id:    int
    name:           str
    phone:          Optional[str] = None
    email:          Optional[str] = None
    address:        Optional[str] = None
    customer_type:  str
    loyalty_points: int
    notes:          Optional[str] = None
    is_active:      bool
    created_at:     datetime
    sale_count:     int = 0

    model_config = {"from_attributes": True}


class CustomerListResponse(BaseModel):
    id:             int
    name:           str
    phone:          Optional[str] = None
    email:          Optional[str] = None
    customer_type:  str
    loyalty_points: int
    is_active:      bool
    sale_count:     int = 0
    created_at:     datetime

    model_config = {"from_attributes": True}
