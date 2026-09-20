"""
Sale & SaleItem models — Phase 8.

A Sale represents one POS transaction.
SaleItem is one line in that sale (one variant, N units, frozen price).

DESIGN:
- Sale.customer_id is nullable — walk-in sales don't need a customer record.
- Prices are FROZEN at sale time into SaleItem.unit_price.
  Never look up variant.selling_price retroactively for old sales.
- For serialized products, each SerialNumber is transitioned to SOLD
  and its sale_item_id is set to the SaleItem.id.
- Loyalty points: earned = floor(net_total / 100), redeemed = value passed in.
  1 point = ৳0.10, so 100 pts = ৳10.

PAYMENT STATUS:
  DUE     → paid_amount = 0
  PARTIAL → 0 < paid_amount < net_payable
  PAID    → paid_amount >= net_payable
"""

from sqlalchemy import Column, Integer, String, Boolean, Text, Numeric, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

SALE_PAYMENT_STATUSES = ("PAID", "PARTIAL", "DUE")


class Sale(TimestampMixin, Base):
    __tablename__ = "sales"

    id                      = Column(Integer, primary_key=True, index=True)
    business_id             = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id             = Column(Integer, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)

    # Auto-generated reference: SO-2026-00001
    sale_number             = Column(String(100), unique=True, nullable=False, index=True)

    sale_date               = Column(Date, nullable=False)
    total_amount            = Column(Numeric(12, 2), nullable=False, default=0)   # sum of line items
    discount_amount         = Column(Numeric(12, 2), nullable=False, default=0)   # overall discount
    loyalty_points_redeemed = Column(Integer, nullable=False, default=0)
    loyalty_points_earned   = Column(Integer, nullable=False, default=0)
    paid_amount             = Column(Numeric(12, 2), nullable=False, default=0)
    payment_status          = Column(String(20), nullable=False, default="DUE")   # PAID | PARTIAL | DUE
    notes                   = Column(Text, nullable=True)

    created_by              = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    customer = relationship("Customer", foreign_keys=[customer_id])
    items    = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")

    @property
    def net_payable(self) -> float:
        """Total after discount and loyalty redemption (100 pts = ৳10)."""
        loyalty_value = self.loyalty_points_redeemed * 0.10
        return max(0.0, float(self.total_amount or 0) - float(self.discount_amount or 0) - loyalty_value)

    @property
    def due_amount(self) -> float:
        return max(0.0, self.net_payable - float(self.paid_amount or 0))

    def __repr__(self):
        return f"<Sale id={self.id} number='{self.sale_number}'>"


class SaleItem(Base):
    __tablename__ = "sale_items"

    id              = Column(Integer, primary_key=True, index=True)
    sale_id         = Column(Integer, ForeignKey("sales.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id      = Column(Integer, ForeignKey("product_variants.id", ondelete="RESTRICT"), nullable=False, index=True)
    quantity        = Column(Integer, nullable=False, default=1)

    # Price & Warranty FROZEN at sale time — never updated after creation
    unit_price      = Column(Numeric(12, 2), nullable=False, default=0)
    discount_amount = Column(Numeric(12, 2), nullable=False, default=0)  # per-line discount
    total_price     = Column(Numeric(12, 2), nullable=False, default=0)  # (unit_price - discount) * qty

    # Warranty agreed at sale time (e.g. "1 Year", "2 Years", "7 Days", "No Warranty")
    warranty_period = Column(String(100), nullable=True)
    warranty_months = Column(Integer, nullable=True, default=0)

    notes           = Column(Text, nullable=True)

    sale    = relationship("Sale", back_populates="items")
    variant = relationship("ProductVariant")
    # serials sold under this sale item (FK is on SerialNumber.sale_item_id)
    serials = relationship(
        "SerialNumber",
        primaryjoin="SaleItem.id == foreign(SerialNumber.sale_item_id)",
        lazy="select",
    )

    def __repr__(self):
        return f"<SaleItem id={self.id} variant_id={self.variant_id} qty={self.quantity}>"
