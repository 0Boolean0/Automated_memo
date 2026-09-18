"""
Purchase service — the core stock-receiving workflow.

RECEIVE STOCK FLOW:
    1. Validate supplier, variants, serial uniqueness
    2. Create Purchase record
    3. For each item: create PurchaseItem
    4. For serialized variants: create SerialNumber(s), status=IN_STOCK
    5. For non-serialized: increment variant.current_stock
    6. Compute totals, set payment_status
    7. Commit everything atomically (all-or-nothing)

If anything fails, the entire transaction is rolled back.
No partial stock updates.
"""

import math
from datetime import datetime, timezone, date
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException

from app.models.purchase import Purchase, PurchaseItem
from app.models.product import ProductVariant, Product
from app.models.serial import SerialNumber
from app.schemas.purchase import PurchaseCreate, PurchaseResponse, PurchaseListResponse, PurchaseItemResponse


# ─── Purchase number generator ────────────────────────────────────────────────

def _next_purchase_number(db: Session, business_id: int) -> str:
    """Generate sequential purchase number: PO-2026-00001"""
    year = datetime.now(timezone.utc).year
    count = db.query(func.count(Purchase.id)).filter(
        Purchase.business_id == business_id
    ).scalar() or 0
    return f"PO-{year}-{count + 1:05d}"


# ─── Response builder ────────────────────────────────────────────────────────

def _build_response(db: Session, purchase: Purchase) -> PurchaseResponse:
    items_out = []
    for item in purchase.items:
        serial_count = db.query(func.count(SerialNumber.id)).filter(
            SerialNumber.purchase_item_id == item.id
        ).scalar() or 0
        variant = item.variant
        product = variant.product if variant else None
        items_out.append(PurchaseItemResponse(
            id=item.id,
            variant_id=item.variant_id,
            variant_name=variant.name if variant else None,
            product_name=product.name if product else None,
            sku=variant.sku if variant else None,
            quantity=item.quantity,
            unit_cost=item.unit_cost,
            total_cost=item.total_cost,
            notes=item.notes,
            serial_count=serial_count,
        ))

    return PurchaseResponse(
        id=purchase.id,
        business_id=purchase.business_id,
        supplier_id=purchase.supplier_id,
        supplier_name=purchase.supplier.name if purchase.supplier else None,
        purchase_number=purchase.purchase_number,
        invoice_number=purchase.invoice_number,
        purchase_date=purchase.purchase_date,
        total_amount=purchase.total_amount,
        paid_amount=purchase.paid_amount,
        due_amount=purchase.due_amount,
        payment_status=purchase.payment_status,
        notes=purchase.notes,
        created_at=purchase.created_at,
        items=items_out,
    )


# ─── Main receive-stock function ──────────────────────────────────────────────

def receive_stock(
    db: Session,
    business_id: int,
    user_id: int,
    data: PurchaseCreate,
) -> Purchase:
    """
    Atomically create a purchase with all items and serials.
    Updates stock counts. Validates serial uniqueness.
    """
    # ── Pre-validate all items before touching DB ──────────────────────────
    all_incoming_serials: list[str] = []

    for item_data in data.items:
        # Variant must belong to this business
        variant: ProductVariant | None = (
            db.query(ProductVariant)
            .join(Product)
            .filter(ProductVariant.id == item_data.variant_id, Product.business_id == business_id)
            .first()
        )
        if not variant:
            raise HTTPException(
                status_code=404,
                detail=f"Variant id={item_data.variant_id} not found in this business",
            )

        is_serialized = variant.product.is_serialized

        if is_serialized:
            # Serial count must match quantity
            if len(item_data.serials) != item_data.quantity:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Variant '{variant.name}': quantity is {item_data.quantity} "
                        f"but {len(item_data.serials)} serial(s) provided"
                    ),
                )

            serials_for_item = [s.serial.strip() for s in item_data.serials]

            # No duplicates within this batch
            if len(serials_for_item) != len(set(serials_for_item)):
                raise HTTPException(
                    status_code=409,
                    detail=f"Variant '{variant.name}': duplicate serial numbers in request",
                )

            # Check against DB
            existing = db.query(SerialNumber).filter(
                SerialNumber.serial.in_(serials_for_item)
            ).first()
            if existing:
                raise HTTPException(
                    status_code=409,
                    detail=f"Serial '{existing.serial}' already exists in the system",
                )

            all_incoming_serials.extend(serials_for_item)

    # Cross-item duplicate check
    if len(all_incoming_serials) != len(set(all_incoming_serials)):
        raise HTTPException(
            status_code=409,
            detail="Duplicate serial numbers across multiple items in this request",
        )

    # ── Create Purchase ────────────────────────────────────────────────────
    purchase = Purchase(
        business_id=business_id,
        supplier_id=data.supplier_id,
        purchase_number=_next_purchase_number(db, business_id),
        invoice_number=data.invoice_number,
        purchase_date=data.purchase_date,
        paid_amount=data.paid_amount,
        notes=data.notes,
        created_by=user_id,
    )
    db.add(purchase)
    db.flush()  # get purchase.id

    grand_total = Decimal("0")
    now = datetime.now(timezone.utc)

    # ── Process each item ──────────────────────────────────────────────────
    for item_data in data.items:
        variant = (
            db.query(ProductVariant)
            .join(Product)
            .filter(ProductVariant.id == item_data.variant_id, Product.business_id == business_id)
            .first()
        )
        is_serialized = variant.product.is_serialized
        item_total = item_data.unit_cost * item_data.quantity

        purchase_item = PurchaseItem(
            purchase_id=purchase.id,
            variant_id=variant.id,
            quantity=item_data.quantity,
            unit_cost=item_data.unit_cost,
            total_cost=item_total,
            notes=item_data.notes,
        )
        db.add(purchase_item)
        db.flush()  # get purchase_item.id

        if is_serialized:
            for serial_input in item_data.serials:
                sn = SerialNumber(
                    business_id=business_id,
                    variant_id=variant.id,
                    serial=serial_input.serial.strip(),
                    status="IN_STOCK",
                    cost_price=item_data.unit_cost,
                    purchase_item_id=purchase_item.id,
                    received_at=now,
                    notes=serial_input.notes,
                )
                db.add(sn)

        # Always bump current_stock for all variants (both serialized and non-serialized)
        variant.current_stock += item_data.quantity

        # Also update variant cost price to latest received cost
        variant.cost_price = item_data.unit_cost
        grand_total += item_total

    # ── Finalize Purchase ──────────────────────────────────────────────────
    purchase.total_amount = grand_total

    paid = Decimal(str(data.paid_amount))
    if paid >= grand_total:
        purchase.payment_status = "PAID"
    elif paid > 0:
        purchase.payment_status = "PARTIAL"
    else:
        purchase.payment_status = "DUE"

    db.commit()
    db.refresh(purchase)
    return purchase


# ─── List + Get ───────────────────────────────────────────────────────────────

def list_purchases(db: Session, business_id: int, supplier_id: int | None = None,
                   page: int = 1, per_page: int = 20):
    q = db.query(Purchase).filter(Purchase.business_id == business_id)
    if supplier_id:
        q = q.filter(Purchase.supplier_id == supplier_id)
    total = q.count()
    purchases = q.order_by(Purchase.purchase_date.desc(), Purchase.id.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    items = []
    for p in purchases:
        items.append(PurchaseListResponse(
            id=p.id,
            purchase_number=p.purchase_number,
            supplier_name=p.supplier.name if p.supplier else None,
            purchase_date=p.purchase_date,
            total_amount=p.total_amount,
            paid_amount=p.paid_amount,
            payment_status=p.payment_status,
            item_count=len(p.items),
            created_at=p.created_at,
        ))

    return {
        "items": items, "total": total, "page": page,
        "per_page": per_page, "pages": math.ceil(total / per_page) if total else 0,
    }


def get_purchase(db: Session, purchase_id: int, business_id: int) -> Purchase:
    p = db.query(Purchase).filter(
        Purchase.id == purchase_id, Purchase.business_id == business_id
    ).first()
    if not p:
        raise HTTPException(status_code=404, detail="Purchase not found")
    return p
