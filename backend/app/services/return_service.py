"""
Return service — Phase 11.

CREATE RETURN FLOW:
    1. Validate sale belongs to this business (if provided)
    2. Validate each item/serial
    3. Create Return header
    4. For each ReturnItem:
       - Serialized + GOOD:    serial → RETURNED, then → IN_STOCK; stock += 1
       - Serialized + DAMAGED: serial → RETURNED, then → DAMAGED;  stock unchanged
       - Non-serialized GOOD:  variant.current_stock += quantity
       - Non-serialized DAMAGED: stock unchanged (write-off)
    5. Commit atomically
"""

import math
from datetime import datetime, timezone, date
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException

from app.models.return_ import Return, ReturnItem
from app.models.sale import Sale
from app.models.product import ProductVariant, Product
from app.models.serial import SerialNumber, VALID_TRANSITIONS
from app.models.customer import Customer
from app.schemas.return_ import (
    ReturnCreate, ReturnResponse, ReturnListResponse,
    ReturnItemResponse, RefundStatusUpdate,
)


# ── Return number generator ───────────────────────────────────────────────────

def _next_return_number(db: Session, business_id: int) -> str:
    year = datetime.now(timezone.utc).year
    count = db.query(func.count(Return.id)).filter(
        Return.business_id == business_id
    ).scalar() or 0
    return f"RT-{year}-{count + 1:05d}"


# ── Response builder ──────────────────────────────────────────────────────────

def _build_response(ret: Return) -> ReturnResponse:
    items_out = []
    for item in ret.items:
        variant = item.variant
        product = variant.product if variant else None
        sn      = item.serial
        items_out.append(ReturnItemResponse(
            id=item.id,
            variant_id=item.variant_id,
            variant_name=variant.name if variant else None,
            product_name=product.name if product else None,
            sku=variant.sku if variant else None,
            serial_id=item.serial_id,
            serial_number=sn.serial if sn else None,
            quantity=item.quantity,
            condition=item.condition,
            notes=item.notes,
        ))

    sale     = ret.sale
    customer = ret.customer
    return ReturnResponse(
        id=ret.id,
        business_id=ret.business_id,
        sale_id=ret.sale_id,
        sale_number=sale.sale_number if sale else None,
        customer_id=ret.customer_id,
        customer_name=customer.name if customer else None,
        return_number=ret.return_number,
        return_date=ret.return_date,
        reason=ret.reason,
        return_type=ret.return_type,
        refund_amount=ret.refund_amount,
        refund_status=ret.refund_status,
        notes=ret.notes,
        created_at=ret.created_at,
        items=items_out,
    )


# ── Create return ─────────────────────────────────────────────────────────────

def create_return(
    db: Session,
    business_id: int,
    user_id: int,
    data: ReturnCreate,
) -> Return:
    now = datetime.now(timezone.utc)

    # Validate sale (if provided)
    sale: Sale | None = None
    if data.sale_id:
        sale = db.query(Sale).filter(
            Sale.id == data.sale_id,
            Sale.business_id == business_id,
        ).first()
        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found")

    # Pre-validate all items
    for item_data in data.items:
        variant: ProductVariant | None = (
            db.query(ProductVariant)
            .join(Product)
            .filter(
                ProductVariant.id == item_data.variant_id,
                Product.business_id == business_id,
            )
            .first()
        )
        if not variant:
            raise HTTPException(
                status_code=404,
                detail=f"Variant id={item_data.variant_id} not found",
            )

        is_serialized = variant.product.is_serialized

        if is_serialized:
            if not item_data.serial_id:
                raise HTTPException(
                    status_code=422,
                    detail=f"Serial ID required for serialized variant '{variant.name}'",
                )
            sn = db.query(SerialNumber).filter(
                SerialNumber.id == item_data.serial_id,
                SerialNumber.business_id == business_id,
                SerialNumber.variant_id == variant.id,
            ).first()
            if not sn:
                raise HTTPException(
                    status_code=404,
                    detail=f"Serial id={item_data.serial_id} not found",
                )
            if not sn.can_transition_to("RETURNED"):
                raise HTTPException(
                    status_code=422,
                    detail=f"Serial '{sn.serial}' is {sn.status} — cannot be returned",
                )

    # Create Return header
    ret = Return(
        business_id=business_id,
        sale_id=data.sale_id,
        customer_id=data.customer_id,
        return_number=_next_return_number(db, business_id),
        return_date=data.return_date,
        reason=data.reason,
        return_type=data.return_type,
        refund_amount=data.refund_amount,
        refund_status=data.refund_status,
        notes=data.notes,
        created_by=user_id,
    )
    db.add(ret)
    db.flush()

    # Process each item
    for item_data in data.items:
        variant = (
            db.query(ProductVariant)
            .join(Product)
            .filter(
                ProductVariant.id == item_data.variant_id,
                Product.business_id == business_id,
            )
            .first()
        )
        is_serialized = variant.product.is_serialized
        condition     = item_data.condition  # GOOD | DAMAGED

        return_item = ReturnItem(
            return_id=ret.id,
            variant_id=variant.id,
            serial_id=item_data.serial_id,
            quantity=item_data.quantity,
            condition=condition,
            notes=item_data.notes,
        )
        db.add(return_item)

        if is_serialized and item_data.serial_id:
            sn = db.query(SerialNumber).filter(
                SerialNumber.id == item_data.serial_id
            ).first()
            if sn:
                # SOLD → RETURNED → IN_STOCK or DAMAGED
                sn.status = "RETURNED"
                if condition == "GOOD":
                    sn.status = "IN_STOCK"
                    variant.current_stock += 1
                else:
                    sn.status = "DAMAGED"
        else:
            # Non-serialized
            if condition == "GOOD":
                variant.current_stock += item_data.quantity
            # DAMAGED → no stock change (write-off)

    db.commit()
    db.refresh(ret)
    return ret


# ── List + Get ────────────────────────────────────────────────────────────────

def list_returns(
    db: Session,
    business_id: int,
    sale_id: int | None = None,
    customer_id: int | None = None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    q = db.query(Return).filter(Return.business_id == business_id)
    if sale_id:
        q = q.filter(Return.sale_id == sale_id)
    if customer_id:
        q = q.filter(Return.customer_id == customer_id)

    total = q.count()
    returns = (
        q.order_by(Return.return_date.desc(), Return.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    items = []
    for r in returns:
        items.append(ReturnListResponse(
            id=r.id,
            return_number=r.return_number,
            sale_number=r.sale.sale_number if r.sale else None,
            customer_name=r.customer.name if r.customer else None,
            return_date=r.return_date,
            return_type=r.return_type,
            refund_amount=r.refund_amount,
            refund_status=r.refund_status,
            item_count=len(r.items),
            created_at=r.created_at,
        ))

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total else 0,
    }


def get_return(db: Session, return_id: int, business_id: int) -> Return:
    r = db.query(Return).filter(
        Return.id == return_id,
        Return.business_id == business_id,
    ).first()
    if not r:
        raise HTTPException(status_code=404, detail="Return not found")
    return r


def update_refund_status(
    db: Session,
    return_id: int,
    business_id: int,
    data: RefundStatusUpdate,
) -> Return:
    r = get_return(db, return_id, business_id)
    r.refund_status = data.refund_status
    db.commit()
    db.refresh(r)
    return r
