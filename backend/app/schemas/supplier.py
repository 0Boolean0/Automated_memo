"""Supplier Pydantic schemas."""

from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class SupplierContactCreate(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    is_primary: bool = False

class SupplierContactResponse(BaseModel):
    id: int
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    is_primary: bool
    model_config = {"from_attributes": True}


class SupplierCreate(BaseModel):
    name: str
    company: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    contacts: list[SupplierContactCreate] = []

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

class SupplierResponse(BaseModel):
    id: int
    business_id: int
    name: str
    company: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool
    created_at: datetime
    contacts: list[SupplierContactResponse] = []
    purchase_count: int = 0
    model_config = {"from_attributes": True}

class SupplierListResponse(BaseModel):
    id: int
    name: str
    company: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    purchase_count: int = 0
    created_at: datetime
    model_config = {"from_attributes": True}
