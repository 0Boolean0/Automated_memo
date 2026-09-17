"""
Business model.

This represents a single shop/company using the system.
In the MVP, there will be exactly ONE business record.
In the future SaaS version, each paying customer will be a separate Business.

All other major tables will have a business_id foreign key pointing here,
which is what enables multi-tenant data isolation in the future.
"""

from sqlalchemy import Column, Integer, String, Boolean, Text
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin


class Business(TimestampMixin, Base):
    __tablename__ = "businesses"

    id = Column(Integer, primary_key=True, index=True)

    # Basic identity
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    # slug is a URL-friendly version of the name, e.g., "my-gadget-shop"
    # Used in future multi-tenant URLs: smartstock.com/my-gadget-shop/dashboard

    # Contact info
    phone = Column(String(50), nullable=True)
    email = Column(String(255), nullable=True)
    address = Column(Text, nullable=True)
    website = Column(String(255), nullable=True)

    # Branding
    logo_url = Column(String(500), nullable=True)

    # Business details
    tax_number = Column(String(100), nullable=True)   # VAT/TIN number if applicable
    currency = Column(String(10), nullable=False, default="BDT")

    is_active = Column(Boolean, default=True, nullable=False)

    # ─── Relationships ────────────────────────────────────────────────────────
    # back_populates links both sides of the relationship together.
    # lazy="dynamic" means related records are not loaded unless accessed.
    users = relationship("User", back_populates="business", lazy="select")

    def __repr__(self):
        return f"<Business id={self.id} name='{self.name}'>"
