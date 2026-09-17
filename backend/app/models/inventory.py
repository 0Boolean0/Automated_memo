"""
Inventory Adjustment model — Phase 5.

Tracks manual and automatic adjustments to stock with full audit trail.
Every adjustment is recorded with:
  - Type (PHYSICAL_COUNT, DAMAGE, LOSS, TRANSFER, RETURN, CORRECTION)
  - Quantity adjusted
  - Reason (mandatory text field)
  - User who made the adjustment
  - Timestamp (automatic)
"""

from enum import Enum
from sqlalchemy import Column, Integer, String, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin


class AdjustmentType(str, Enum):
    """Enum of all possible adjustment types."""
    PHYSICAL_COUNT = "PHYSICAL_COUNT"  # Physical inventory count discrepancy
    DAMAGE = "DAMAGE"                  # Stock damaged and removed from inventory
    LOSS = "LOSS"                      # Stock lost/stolen
    TRANSFER = "TRANSFER"              # Stock transferred between variants or locations
    RETURN = "RETURN"                  # Return from customer or supplier
    CORRECTION = "CORRECTION"          # Correction of a previous error


class InventoryAdjustment(TimestampMixin, Base):
    """
    Records every adjustment to inventory with full audit trail.

    Fields:
        variant_id: The product variant being adjusted
        adjustment_type: One of AdjustmentType enum values
        quantity_change: The quantity adjusted (positive or negative)
        reason: Required text explaining why the adjustment was made
        adjusted_by: User ID of who made the adjustment (from JWT or session)
        notes: Optional additional notes

    Example:
        - Physical inventory count found 5 units missing
          → AdjustmentType.PHYSICAL_COUNT, quantity_change=-5, reason="Stock count discrepancy"

        - 2 units damaged in shipment
          → AdjustmentType.DAMAGE, quantity_change=-2, reason="Damaged during transit"

        - Correction of a previous over-count
          → AdjustmentType.CORRECTION, quantity_change=-3, reason="Reversing over-count from 2024-12-15"
    """
    __tablename__ = "inventory_adjustments"

    id                = Column(Integer, primary_key=True, index=True)
    business_id       = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    variant_id        = Column(Integer, ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False, index=True)
    adjustment_type   = Column(SQLEnum(AdjustmentType), nullable=False, index=True)
    quantity_change   = Column(Integer, nullable=False)  # Can be positive or negative
    reason            = Column(Text, nullable=False)     # Required: explain why this adjustment was made
    adjusted_by       = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    notes             = Column(Text, nullable=True)      # Optional additional context

    # Relationships
    variant = relationship("ProductVariant", foreign_keys=[variant_id])
    adjusted_by_user = relationship("User", foreign_keys=[adjusted_by])

    def __repr__(self):
        return f"<InventoryAdjustment id={self.id} type={self.adjustment_type} qty={self.quantity_change}>"
