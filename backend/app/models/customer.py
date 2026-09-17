"""
Customer model — Phase 7.

A Customer is anyone who buys from the business.
Customers are optional on sales (walk-in customers don't need an account),
but linking a sale to a customer enables:
  - Purchase history per customer
  - Warranty tracking
  - Returns management

DESIGN NOTES:
- customer_type: RETAIL (default) or WHOLESALE — affects pricing rules in Phase 8
- loyalty_points: accumulated on sales, redeemable in Phase 8 (stored as int, e.g. 100 pts = ৳10)
- Sales will reference customers via Sale.customer_id FK (Phase 8)
"""

from sqlalchemy import Column, Integer, String, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin

CUSTOMER_TYPES = ("RETAIL", "WHOLESALE")


class Customer(TimestampMixin, Base):
    __tablename__ = "customers"

    id              = Column(Integer, primary_key=True, index=True)
    business_id     = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    name            = Column(String(255), nullable=False, index=True)
    phone           = Column(String(50),  nullable=True,  index=True)
    email           = Column(String(255), nullable=True)
    address         = Column(Text,        nullable=True)
    customer_type   = Column(String(20),  nullable=False, default="RETAIL")   # RETAIL | WHOLESALE
    loyalty_points  = Column(Integer,     nullable=False, default=0)
    notes           = Column(Text,        nullable=True)
    is_active       = Column(Boolean,     default=True,   nullable=False)

    def __repr__(self):
        return f"<Customer id={self.id} name='{self.name}'>"
