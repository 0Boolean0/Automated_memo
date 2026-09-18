"""
WarrantyClaim model — Phase 10.

WARRANTY LOGIC:
- Every serialized unit sold has a warranty period = ProductVariant.warranty_months
- Warranty starts at SerialNumber.sold_at
- Warranty expires at sold_at + warranty_months
- warranty_months == 0 → no warranty

WARRANTY STATUS (computed, not stored):
  ACTIVE    → today < expiry_date
  EXPIRING  → today is within 30 days of expiry_date
  EXPIRED   → today >= expiry_date
  NO_WARRANTY → warranty_months == 0

CLAIM STATUSES:
  OPEN       → claim filed, not yet processed
  IN_REPAIR  → unit received and being repaired
  RESOLVED   → repaired/replaced, returned to customer
  REJECTED   → claim denied (out of warranty, physical damage, etc.)
"""

from sqlalchemy import Column, Integer, String, Text, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

CLAIM_STATUSES = ("OPEN", "IN_REPAIR", "RESOLVED", "REJECTED")


class WarrantyClaim(TimestampMixin, Base):
    __tablename__ = "warranty_claims"

    id              = Column(Integer, primary_key=True, index=True)
    business_id     = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"),  nullable=False, index=True)
    serial_id       = Column(Integer, ForeignKey("serial_numbers.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id     = Column(Integer, ForeignKey("customers.id",  ondelete="SET NULL"), nullable=True,  index=True)

    # Claim details
    claim_number    = Column(String(50),  unique=True, nullable=False, index=True)  # WC-2026-00001
    issue_desc      = Column(Text,        nullable=False)   # what the customer reported
    status          = Column(String(20),  nullable=False, default="OPEN")
    resolution_note = Column(Text,        nullable=True)    # how it was resolved / why rejected
    claimed_by      = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_by     = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at     = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    serial    = relationship("SerialNumber",  foreign_keys=[serial_id])
    customer  = relationship("Customer",      foreign_keys=[customer_id])

    def __repr__(self):
        return f"<WarrantyClaim id={self.id} number='{self.claim_number}' status={self.status}>"
