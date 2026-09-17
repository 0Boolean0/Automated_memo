"""
SerialNumber model.

Full business logic (receive, sell, return, warranty) is implemented in
Phase 4 (Purchases) and Phase 5 (Inventory).
Defined here in Phase 3 so ProductVariant can reference it.

SERIAL STATUS STATE MACHINE:
    RECEIVED   → accepted from supplier, not yet added to live inventory
    IN_STOCK   → available for sale
    RESERVED   → held for an order (future feature)
    SOLD       → sold to a customer
    RETURNED   → returned by customer, pending inspection
    DAMAGED    → written off as damaged/defective
    WARRANTY   → sent for warranty service
    TRANSFERRED → moved to another branch (future)
    CANCELLED  → cancelled/written off administratively
"""

from sqlalchemy import Column, Integer, String, Numeric, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

# Valid statuses — enforced at service layer
SERIAL_STATUSES = (
    "RECEIVED", "IN_STOCK", "RESERVED", "SOLD",
    "RETURNED", "DAMAGED", "WARRANTY", "TRANSFERRED", "CANCELLED",
)

# Valid status transitions (from → set of allowed to)
VALID_TRANSITIONS: dict[str, set[str]] = {
    "RECEIVED":    {"IN_STOCK", "CANCELLED"},
    "IN_STOCK":    {"RESERVED", "SOLD", "DAMAGED", "TRANSFERRED", "CANCELLED"},
    "RESERVED":    {"IN_STOCK", "SOLD", "CANCELLED"},
    "SOLD":        {"RETURNED", "WARRANTY"},
    "RETURNED":    {"IN_STOCK", "DAMAGED"},
    "WARRANTY":    {"IN_STOCK", "DAMAGED", "SOLD"},
    "DAMAGED":     {"CANCELLED"},
    "TRANSFERRED": {"IN_STOCK"},
    "CANCELLED":   set(),  # terminal state
}


class SerialNumber(TimestampMixin, Base):
    __tablename__ = "serial_numbers"

    id               = Column(Integer, primary_key=True, index=True)
    business_id      = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id       = Column(Integer, ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False, index=True)

    # The actual serial number string — must be unique across all businesses
    serial           = Column(String(200), unique=True, nullable=False, index=True)

    status           = Column(String(20), nullable=False, default="RECEIVED")

    # Frozen prices at time of purchase — never change after recording
    cost_price       = Column(Numeric(12, 2), nullable=True)

    # FKs set when transitions happen — tables added in Phase 4/8
    purchase_item_id = Column(Integer, nullable=True)
    sale_item_id     = Column(Integer, nullable=True)

    notes            = Column(Text, nullable=True)
    received_at      = Column(DateTime(timezone=True), nullable=True)
    sold_at          = Column(DateTime(timezone=True), nullable=True)

    # Relationships (fully wired in Phase 4/5)
    variant = relationship("ProductVariant", back_populates="serials")

    def can_transition_to(self, new_status: str) -> bool:
        return new_status in VALID_TRANSITIONS.get(self.status, set())

    def __repr__(self):
        return f"<Serial '{self.serial}' status={self.status}>"
