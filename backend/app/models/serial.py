"""
SerialNumber model — updated in Phase 4 with real purchase_item FK.
"""

from sqlalchemy import Column, Integer, String, Numeric, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

SERIAL_STATUSES = (
    "RECEIVED", "IN_STOCK", "RESERVED", "SOLD",
    "RETURNED", "DAMAGED", "WARRANTY", "TRANSFERRED", "CANCELLED",
)

VALID_TRANSITIONS: dict[str, set[str]] = {
    "RECEIVED":    {"IN_STOCK", "CANCELLED"},
    "IN_STOCK":    {"RESERVED", "SOLD", "DAMAGED", "TRANSFERRED", "CANCELLED"},
    "RESERVED":    {"IN_STOCK", "SOLD", "CANCELLED"},
    "SOLD":        {"RETURNED", "WARRANTY"},
    "RETURNED":    {"IN_STOCK", "DAMAGED"},
    "WARRANTY":    {"IN_STOCK", "DAMAGED", "SOLD"},
    "DAMAGED":     {"CANCELLED"},
    "TRANSFERRED": {"IN_STOCK"},
    "CANCELLED":   set(),
}


class SerialNumber(TimestampMixin, Base):
    __tablename__ = "serial_numbers"

    id               = Column(Integer, primary_key=True, index=True)
    business_id      = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id       = Column(Integer, ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False, index=True)
    serial           = Column(String(200), unique=True, nullable=False, index=True)
    status           = Column(String(20),  nullable=False, default="IN_STOCK")
    cost_price       = Column(Numeric(12, 2), nullable=True)

    # Phase 4: real FK to purchase_items
    purchase_item_id = Column(Integer, ForeignKey("purchase_items.id", ondelete="SET NULL"), nullable=True, index=True)
    # Phase 8: FK to sale_items (plain int until that table exists)
    sale_item_id     = Column(Integer, nullable=True)

    notes       = Column(Text,                    nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=True)
    sold_at     = Column(DateTime(timezone=True), nullable=True)

    variant       = relationship("ProductVariant", back_populates="serials")
    purchase_item = relationship("PurchaseItem", back_populates="serials", foreign_keys=[purchase_item_id])

    def can_transition_to(self, new_status: str) -> bool:
        return new_status in VALID_TRANSITIONS.get(self.status, set())

    def __repr__(self):
        return f"<Serial '{self.serial}' status={self.status}>"
