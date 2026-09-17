"""
Purchase & PurchaseItem models.

A Purchase represents one stock-receiving event from a supplier.
PurchaseItem is one line in that purchase (one variant, N units).

WORKFLOW:
    1. User selects supplier + fills purchase details
    2. Adds purchase items (variant + quantity + cost)
    3. For serialized products: enters each serial number
    4. Confirms → creates serials, updates stock, writes audit log

PAYMENT TRACKING:
    Purchase has its own payment status (did you pay the supplier?).
    This is separate from customer payment (that's on Sale model in Phase 8).
"""

from sqlalchemy import Column, Integer, String, Boolean, Text, Numeric, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

PURCHASE_PAYMENT_STATUSES = ("PAID", "PARTIAL", "DUE")


class Purchase(TimestampMixin, Base):
    __tablename__ = "purchases"

    id              = Column(Integer, primary_key=True, index=True)
    business_id     = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    supplier_id     = Column(Integer, ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=True, index=True)

    # Auto-generated reference number e.g. PO-2026-00001
    purchase_number = Column(String(100), unique=True, nullable=False, index=True)
    # Supplier's invoice / challan number
    invoice_number  = Column(String(100), nullable=True)

    purchase_date   = Column(Date, nullable=False)
    total_amount    = Column(Numeric(12, 2), nullable=False, default=0)
    paid_amount     = Column(Numeric(12, 2), nullable=False, default=0)
    payment_status  = Column(String(20),     nullable=False, default="DUE")
    notes           = Column(Text,           nullable=True)

    created_by      = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    supplier = relationship("Supplier", back_populates="purchases")
    items    = relationship("PurchaseItem", back_populates="purchase", cascade="all, delete-orphan")

    @property
    def due_amount(self):
        return float(self.total_amount or 0) - float(self.paid_amount or 0)

    def __repr__(self):
        return f"<Purchase id={self.id} number='{self.purchase_number}'>"


class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id          = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchases.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id  = Column(Integer, ForeignKey("product_variants.id", ondelete="RESTRICT"), nullable=False, index=True)
    quantity    = Column(Integer,         nullable=False, default=1)
    unit_cost   = Column(Numeric(12, 2),  nullable=False, default=0)
    total_cost  = Column(Numeric(12, 2),  nullable=False, default=0)
    notes       = Column(Text,            nullable=True)

    purchase = relationship("Purchase", back_populates="items")
    variant  = relationship("ProductVariant")
    # serials registered under this purchase item
    serials  = relationship("SerialNumber", foreign_keys="[SerialNumber.purchase_item_id]")

    def __repr__(self):
        return f"<PurchaseItem id={self.id} variant_id={self.variant_id} qty={self.quantity}>"
