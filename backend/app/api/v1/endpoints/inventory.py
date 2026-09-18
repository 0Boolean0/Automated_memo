"""
Inventory adjustment endpoints — Phase 5.

POST /adjustments/           → create stock adjustment
GET  /adjustments/           → paginated list of adjustments
GET  /adjustments/{id}       → full detail of one adjustment
GET  /alerts/low-stock       → list variants below reorder level (paginated)
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.auth.dependencies import get_current_user, require_permission
from app.models.user import User
from app.schemas.inventory import (
    AdjustmentCreate,
    AdjustmentResponse,
    LowStockAlertResponse,
)
from app.services import inventory_service

router = APIRouter()


@router.post("", include_in_schema=False)
@router.post("/", response_model=AdjustmentResponse, status_code=201, tags=["Inventory"])
def create_adjustment(
    data: AdjustmentCreate,
    current_user: User = Depends(require_permission("adjust_inventory")),
    db: Session = Depends(get_db),
):
    """
    Create a stock adjustment with full audit trail.

    Adjusts the variant's current_stock and records:
    - Adjustment type (PHYSICAL_COUNT, DAMAGE, LOSS, TRANSFER, RETURN, CORRECTION)
    - Quantity change (positive or negative)
    - Reason (mandatory text explanation)
    - User who made the adjustment
    - Timestamp (automatic)

    Validates:
    - Variant belongs to user's business
    - For serialized products, enough IN_STOCK serials exist for reductions
    - Stock cannot go negative
    """
    adjustment = inventory_service.adjust_stock(
        db, current_user.business_id, current_user.id, data
    )
    return inventory_service._build_adjustment_response(adjustment)


@router.get("", include_in_schema=False)
@router.get("/", response_model=dict, tags=["Inventory"])
def list_adjustments(
    variant_id: Optional[int] = Query(None),
    adjustment_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=500),
    current_user: User = Depends(require_permission("view_inventory")),
    db: Session = Depends(get_db),
):
    """
    List inventory adjustments with optional filtering.

    Query parameters:
    - variant_id: Filter by specific variant
    - adjustment_type: Filter by type (PHYSICAL_COUNT, DAMAGE, LOSS, etc.)
    - page: Page number (1-indexed)
    - per_page: Items per page (1-500)

    Returns paginated list with total count and metadata.
    """
    return inventory_service.list_adjustments(
        db,
        current_user.business_id,
        variant_id=variant_id,
        adjustment_type=adjustment_type,
        page=page,
        per_page=per_page,
    )


@router.get("/alerts/low-stock", response_model=dict, tags=["Inventory"])
def list_low_stock_alerts(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=500),
    current_user: User = Depends(require_permission("view_inventory")),
    db: Session = Depends(get_db),
):
    """
    List all variants below their reorder level.

    Returns variants sorted by urgency (biggest shortage first).
    Each variant includes:
    - current_stock
    - reorder_level
    - shortage (how many units below threshold)
    - cost_price and selling_price for context

    Useful for:
    - Dashboard alerts
    - Purchase planning
    - Stock monitoring
    """
    return inventory_service.list_low_stock_alerts(
        db, current_user.business_id, page=page, per_page=per_page
    )


@router.get("/{adjustment_id}", response_model=AdjustmentResponse, tags=["Inventory"])
def get_adjustment(
    adjustment_id: int,
    current_user: User = Depends(require_permission("view_inventory")),
    db: Session = Depends(get_db),
):
    """Get a single adjustment by ID with full details."""
    adjustment = inventory_service.get_adjustment(db, adjustment_id, current_user.business_id)
    return inventory_service._build_adjustment_response(adjustment)

