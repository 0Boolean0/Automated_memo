"""Warranty Pydantic schemas — Phase 10."""

from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date, datetime


class WarrantyClaimCreate(BaseModel):
    serial_id:   int
    issue_desc:  str
    customer_id: Optional[int] = None

    @field_validator("issue_desc")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Issue description is required")
        return v


class WarrantyClaimUpdate(BaseModel):
    status:          Optional[str] = None   # IN_REPAIR | RESOLVED | REJECTED
    resolution_note: Optional[str] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in ("OPEN", "IN_REPAIR", "RESOLVED", "REJECTED"):
            raise ValueError("Invalid status")
        return v


class WarrantyClaimResponse(BaseModel):
    id:              int
    business_id:     int
    serial_id:       int
    serial_number:   Optional[str] = None
    product_name:    Optional[str] = None
    variant_name:    Optional[str] = None
    customer_id:     Optional[int] = None
    customer_name:   Optional[str] = None
    claim_number:    str
    issue_desc:      str
    status:          str
    resolution_note: Optional[str] = None
    claimed_by_name: Optional[str] = None
    resolved_by_name:Optional[str] = None
    resolved_at:     Optional[datetime] = None
    created_at:      datetime

    model_config = {"from_attributes": True}


# Warranty status for a single serial number (computed, not stored)
class WarrantyStatusResponse(BaseModel):
    serial_id:        int
    serial_number:    str
    product_name:     Optional[str] = None
    variant_name:     Optional[str] = None
    customer_name:    Optional[str] = None
    sale_number:      Optional[str] = None
    sold_at:          Optional[datetime] = None
    warranty_months:  int
    expiry_date:      Optional[date] = None   # None if no warranty
    warranty_status:  str                     # ACTIVE | EXPIRING | EXPIRED | NO_WARRANTY
    days_remaining:   Optional[int] = None    # None if no warranty / already expired
    open_claims:      int = 0

    model_config = {"from_attributes": True}
