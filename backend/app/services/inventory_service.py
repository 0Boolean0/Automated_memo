"""
Inventory service — Phase 5.

Core inventory adjustment workflow:
    1. Validate variant belongs to business
    2. Create InventoryAdjustment record with reason and audit trail
    3. Update variant.current_stock atomically
    4. For serialized products, optionally validate serial count
    5. Commit everything (all-or-nothing)

If anything fails, entire transaction is rolled back.
No partial stock updates.
"""

import math
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException

from app.models.inventory import InventoryAdjustment, AdjustmentType
from app.models.product import ProductVariant, Product
from app.models.serial import SerialNumber
from app.schemas.inventory import (
    AdjustmentCreate,
    AdjustmentResponse,
    LowStockAlertResponse,
)


# ─── Adjust Stock ─────────────────────────────────────────────────────────────

def adjust_stock(
    db: Session,
    business_id: int,
    user_id: int,
    data: AdjustmentCreate,
) -> InventoryAdjustment:
    """
    Atomically adjust stock for a variant.

    Args:
        db: Database session
        business_id: Business ID for authorization
        user_id: User ID making the adjustment
        data: AdjustmentCreate with variant_id, adjustment_type, quantity_change, reason

    Returns:
        InventoryAdjustment record

    Raises:
        HTTPException: if variant not found, invalid adjustment type, etc.
    """
    # ── Validate variant belongs to this business ──────────────────────────
    variant: ProductVariant | None = (
        db.query(ProductVariant)
        .join(Product)
        .filter(ProductVariant.id == data.variant_id, Product.business_id == business_id)
        .first()
    )
    if not variant:
        raise HTTPException(
            status_code=404,
            detail=f"Variant id={data.variant_id} not found in this business",
        )

    product = variant.product

    # ── Validate adjustment type is valid ──────────────────────────────────
    try:
        adjustment_type = AdjustmentType(data.adjustment_type)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid adjustment_type: {data.adjustment_type}. "
                   f"Valid types: {', '.join([t.value for t in AdjustmentType])}",
        )

    # ── For serialized products, validate serial count if needed ────────────
    # If reducing stock for serialized products, ensure enough IN_STOCK serials exist
    if product.is_serialized and data.quantity_change < 0:
        in_stock_count = variant.serials.filter_by(status="IN_STOCK").count()
        if in_stock_count + data.quantity_change < 0:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Cannot reduce stock by {-data.quantity_change}. "
                    f"Only {in_stock_count} units in stock."
                ),
            )

    # ── Create InventoryAdjustment record ──────────────────────────────────
    adjustment = InventoryAdjustment(
        business_id=business_id,
        variant_id=variant.id,
        adjustment_type=adjustment_type,
        quantity_change=data.quantity_change,
        reason=data.reason,
        adjusted_by=user_id,
        notes=data.notes,
    )
    db.add(adjustment)

    # ── Update variant.current_stock ──────────────────────────────────────
    new_stock = variant.current_stock + data.quantity_change
    if new_stock < 0:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Stock cannot go negative. Current: {variant.current_stock}, "
                f"Adjustment: {data.quantity_change}"
            ),
        )

    variant.current_stock = new_stock

    # ── Commit atomically ──────────────────────────────────────────────────
    db.commit()
    db.refresh(adjustment)
    return adjustment


# ─── Response builder ────────────────────────────────────────────────────────

def _build_adjustment_response(adjustment: InventoryAdjustment) -> AdjustmentResponse:
    """Build AdjustmentResponse with related data."""
    variant = adjustment.variant
    product = variant.product if variant else None
    user = adjustment.adjusted_by_user

    return AdjustmentResponse(
        id=adjustment.id,
        business_id=adjustment.business_id,
        variant_id=adjustment.variant_id,
        variant_name=variant.name if variant else None,
        product_name=product.name if product else None,
        sku=variant.sku if variant else None,
        adjustment_type=adjustment.adjustment_type.value,
        quantity_change=adjustment.quantity_change,
        reason=adjustment.reason,
        adjusted_by_user_id=adjustment.adjusted_by,
        adjusted_by_username=user.username if user else None,
        notes=adjustment.notes,
        created_at=adjustment.created_at,
        updated_at=adjustment.updated_at,
    )


# ─── List + Get ────────────────────────────────────────────────────────────────

def list_adjustments(
    db: Session,
    business_id: int,
    variant_id: int | None = None,
    adjustment_type: str | None = None,
    page: int = 1,
    per_page: int = 20,
):
    """
    List inventory adjustments with optional filtering.

    Args:
        db: Database session
        business_id: Business ID for authorization
        variant_id: Optional filter by variant
        adjustment_type: Optional filter by adjustment type
        page: Page number (1-indexed)
        per_page: Items per page

    Returns:
        Dict with items, total, pagination info
    """
    q = db.query(InventoryAdjustment).filter(InventoryAdjustment.business_id == business_id)

    if variant_id:
        q = q.filter(InventoryAdjustment.variant_id == variant_id)

    if adjustment_type:
        try:
            adj_type = AdjustmentType(adjustment_type)
            q = q.filter(InventoryAdjustment.adjustment_type == adj_type)
        except ValueError:
            pass  # Invalid type, just skip the filter

    total = q.count()
    adjustments = (
        q.order_by(InventoryAdjustment.created_at.desc(), InventoryAdjustment.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    items = [_build_adjustment_response(adj) for adj in adjustments]

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total else 0,
    }


def get_adjustment(db: Session, adjustment_id: int, business_id: int) -> InventoryAdjustment:
    """Get a single adjustment by ID."""
    adj = db.query(InventoryAdjustment).filter(
        InventoryAdjustment.id == adjustment_id,
        InventoryAdjustment.business_id == business_id,
    ).first()
    if not adj:
        raise HTTPException(status_code=404, detail="Adjustment not found")
    return adj


# ─── Low-stock alerts ──────────────────────────────────────────────────────────

def list_low_stock_alerts(
    db: Session,
    business_id: int,
    page: int = 1,
    per_page: int = 20,
):
    """
    List all variants below their reorder_level.

    Returns variants with current_stock < reorder_level,
    ordered by how much below the threshold they are.
    """
    # Subquery: all variants below reorder level, joined with products
    q = (
        db.query(ProductVariant)
        .join(Product)
        .filter(
            Product.business_id == business_id,
            ProductVariant.is_active == True,
            ProductVariant.current_stock < ProductVariant.reorder_level,
        )
    )

    total = q.count()
    variants = (
        q.order_by(
            # Most urgent first: biggest shortfall
            (ProductVariant.reorder_level - ProductVariant.current_stock).desc()
        )
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    items = [
        LowStockAlertResponse(
            id=v.id,
            variant_id=v.id,
            variant_name=v.name,
            product_id=v.product_id,
            product_name=v.product.name if v.product else None,
            sku=v.sku,
            current_stock=v.current_stock,
            reorder_level=v.reorder_level,
            shortage=v.reorder_level - v.current_stock,
            cost_price=v.cost_price,
            selling_price=v.selling_price,
        )
        for v in variants
    ]

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total else 0,
    }
