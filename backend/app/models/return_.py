"""
Return & ReturnItem models — Phase 11.

A Return records when a customer brings back items from a sale.
Each line item specifies which variant (and serials for serialized products)
are being returned, and whether each unit is in good condition (→ IN_STOCK)
or damaged (→ DAMAGED).

RETURN TYPES:
  CUSTOMER_RETURN  → customer returning purchased item
  SUPPLIER_RETURN  → returning faulty stock to supplier (future)

CONDITION:
  GOOD    → returned unit is re-stockable (serial → IN_STOCK, stock += qty)
  DAMAGED → unit cannot be resold   (serial → DAMAGED, stock unchanged)

REFUND STATUS:
  PENDING  → refund not yet issued
  ISSUED   → cash/bank refund given
  EXCHANGE → replaced with another unit (no cash)
  NONE     → no refund / partial credit only
"""

from sqlalchemy import Column, Integer, String, Boolean, Text, Numeric, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

RETURN_TYPES      = ("CUSTOMER_RETURN", "SUPPLIER_RETURN")
RETURN_CONDITIONS = ("GOOD", "DAMAGED")
REFUND_STATUSES   = ("PENDING", "ISSUED", "EXCHANGE", "NONE")


class Return(TimestampMixin, Base):
    __tablename__ = "returns"

    id              = Column(Integer, primary_key=True, index=True)
    business_id     = Column(Integer, ForeignKey("businesses.id",  ondelete="CASCADE"),  nullable=False, index=True)
    sale_id         = Column(Integer, ForeignKey("sales.id",       ondelete="SET NULL"), nullable=True,  index=True)
    customer_id     = Column(Integer, ForeignKey("customers.id",   ondelete="SET NULL"), nullable=True,  index=True)

    return_number   = Column(String(50),  unique=True, nullable=False, index=True)  # RT-2026-00001
    return_date     = Column(Date,        nullable=False)
    reason          = Column(Text,        nullable=False)
    return_type     = Column(String(30),  nullable=False, default="CUSTOMER_RETURN")

    refund_amount   = Column(Numeric(12, 2), nullable=False, default=0)
    refund_status   = Column(String(20),  nullable=False, default="PENDING")

    notes           = Column(Text,        nullable=True)
    created_by      = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    sale     = relationship("Sale",     foreign_keys=[sale_id])
    customer = relationship("Customer", foreign_keys=[customer_id])
    items    = relationship("ReturnItem", back_populates="return_", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Return id={self.id} number='{self.return_number}'>"


class ReturnItem(Base):
    __tablename__ = "return_items"

    id          = Column(Integer, primary_key=True, index=True)
    return_id   = Column(Integer, ForeignKey("returns.id",             ondelete="CASCADE"),  nullable=False, index=True)
    variant_id  = Column(Integer, ForeignKey("product_variants.id",    ondelete="RESTRICT"), nullable=False, index=True)
    serial_id   = Column(Integer, ForeignKey("serial_numbers.id",      ondelete="SET NULL"), nullable=True,  index=True)
    quantity    = Column(Integer,     nullable=False, default=1)
    condition   = Column(String(20),  nullable=False, default="GOOD")   # GOOD | DAMAGED
    notes       = Column(Text,        nullable=True)

    return_  = relationship("Return",        back_populates="items")
    variant  = relationship("ProductVariant", foreign_keys=[variant_id])
    serial   = relationship("SerialNumber",   foreign_keys=[serial_id])

    def __repr__(self):
        return f"<ReturnItem id={self.id} variant_id={self.variant_id} condition={self.condition}>"
