"""
Auth-related Pydantic schemas.

Pydantic schemas are the "contract" between the API and the outside world.
They validate incoming request data and shape outgoing response data.
They are NOT the same as SQLAlchemy models:
  - SQLAlchemy model = database table definition
  - Pydantic schema   = API input/output shape

Naming convention:
  - *Create  = data needed to create a record
  - *Update  = data for partial update (all fields optional)
  - *Response = data returned to the client (never expose hashed_password!)
"""

from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime


# ─── Token schemas ────────────────────────────────────────────────────────────

class Token(BaseModel):
    """Returned after successful login."""
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    """Decoded JWT payload (internal use only)."""
    user_id: Optional[int] = None
    username: Optional[str] = None
    business_id: Optional[int] = None


# ─── Role schemas ─────────────────────────────────────────────────────────────

class RoleResponse(BaseModel):
    id: int
    name: str
    permissions: list[str]

    model_config = {"from_attributes": True}


class RoleCreate(BaseModel):
    name: str
    permissions: list[str] = []


class RoleUpdate(BaseModel):
    permissions: list[str]


# ─── User schemas ─────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    role_name: str = "STAFF"  # which role to assign on creation

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("Username must be at least 3 characters")
        return v

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    role_name: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("New password must be at least 6 characters")
        return v


class AdminResetPasswordRequest(BaseModel):
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("New password must be at least 6 characters")
        return v


class UserResponse(BaseModel):
    """Safe user object — never includes hashed_password."""
    id: int
    business_id: int
    username: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    last_login: Optional[datetime] = None
    created_at: datetime
    roles: list[RoleResponse] = []
    permissions: list[str] = []

    model_config = {"from_attributes": True}


# ─── Login schema ─────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    """Full login response: token + user profile."""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ─── Business settings schemas ────────────────────────────────────────────────

class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    website: Optional[str] = None
    currency: Optional[str] = None
    tax_number: Optional[str] = None


class BusinessResponse(BaseModel):
    id: int
    name: str
    slug: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    logo_url: Optional[str] = None
    currency: str
    tax_number: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
