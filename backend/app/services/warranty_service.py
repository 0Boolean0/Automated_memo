"""
Warranty service — Phase 10.

Core concepts:
- Every SOLD serialized unit has a warranty window:
    start  = SerialNumber.sold_at
    expiry = sold_at + ProductVariant.warranty_months months
    warranty_months == 0  → no warranty

- Warranty status (computed each request, never stored):
    NO_WARRANTY → warranty_months == 0
    EXPIRED     → today >= expiry_date
    EXPIRING    → 0 < days_remaining <= 30
    ACTIVE      → days_remaining > 30

- Claims are filed against a serial number.
  One serial can have multiple claims (re-repairs).
  Status flow: OPEN → IN_REPAIR → RESOLVED | REJECTED
"""

import math
from datetime import datetime, timezone, date
from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException

from app.models.warranty import WarrantyClaim, CLAIM_STATUSES
from app.models.serial import SerialNumber
from app.models.sale import SaleItem, Sale
from app.models.customer import Customer
from app.models.product import ProductVariant, Product
from app.schemas.warranty import (
    WarrantyStatusResponse,
    WarrantyClaimCreate,
    WarrantyClaimUpdate,
    WarrantyClaimResponse,
)


# ── Status helpers ────────────────────────────────────────────────────────────

def _compute_warranty_status(
    warranty_months: int,
    sold_at: datetime | None,
    today: date,
) -> tuple[str, date | None, int | None]:
    """
    Returns (status, expiry_date, days_remaining).
    days_remaining is None when there is no warranty or already expired.
    """
    if warranty_months == 0 or sold_at is None:
        return "NO_WARRANTY", None, None

    expiry = (sold_at + relativedelta(months=warranty_months)).date()
    remaining = (expiry - today).days

    if remaining < 0:
        return "EXPIRED", expiry, None
    elif remaining <= 30:
        return "EXPIRING", expiry, remaining
    else:
        return "ACTIVE", expiry, remaining


# ── Claim number generator ────────────────────────────────────────────────────

def _next_claim_number(db: Session, business_id: int) -> str:
    year = datetime.now(timezone.utc).year
    count = db.query(func.count(WarrantyClaim.id)).filter(
        WarrantyClaim.business_id == business_id
    ).scalar() or 0
    return f"WC-{year}-{count + 1:05d}"


# ── Response builder ──────────────────────────────────────────────────────────

def _build_claim_response(claim: WarrantyClaim) -> WarrantyClaimResponse:
    sn = claim.serial
    variant = sn.variant if sn else None
    product = variant.product if variant else None
    customer = claim.customer

    claimed_user = claim.claimed_by  # already an int (user id)
    resolved_user = claim.resolved_by

    return WarrantyClaimResponse(
        id=claim.id,
        business_id=claim.business_id,
        serial_id=claim.serial_id,
        serial_number=sn.serial if sn else None,
        product_name=product.name if product else None,
        variant_name=variant.name if variant else None,
        customer_id=claim.customer_id,
        customer_name=customer.name if customer else None,
        claim_number=claim.claim_number,
        issue_desc=claim.issue_desc,
        status=claim.status,
        resolution_note=claim.resolution_note,
        claimed_by_name=None,   # user name lookup omitted for simplicity
        resolved_by_name=None,
        resolved_at=claim.resolved_at,
        created_at=claim.created_at,
    )


# ── Warranty list (sold serialized units) ────────────────────────────────────

def list_warranty_units(
    db: Session,
    business_id: int,
    status_filter: str | None = None,   # ACTIVE | EXPIRING | EXPIRED | NO_WARRANTY
    search: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    """
    List all SOLD serialized units with their warranty status.
    """
    today = datetime.now(timezone.utc).date()

    # Query all SOLD serial numbers for this business
    q = (
        db.query(SerialNumber)
        .join(ProductVariant, SerialNumber.variant_id == ProductVariant.id)
        .join(Product, ProductVariant.product_id == Product.id)
        .filter(
            SerialNumber.business_id == business_id,
            SerialNumber.status.in_(["SOLD", "RETURNED", "WARRANTY"]),
            Product.is_serialized == True,
        )
    )

    if search:
        q = q.filter(
            SerialNumber.serial.ilike(f"%{search}%") |
            Product.name.ilike(f"%{search}%")
        )

    all_serials = q.order_by(SerialNumber.sold_at.desc()).all()

    # Compute warranty status for each, filter if requested
    items_all = []
    for sn in all_serials:
        variant = sn.variant
        product = variant.product if variant else None
        # Find which customer bought this via sale_item → sale → customer
        customer_name = None
        sale_number = None
        if sn.sale_item_id:
            item = db.query(SaleItem).filter(SaleItem.id == sn.sale_item_id).first()
            if item:
                if item.warranty_months is not None:
                    warranty_months = item.warranty_months
                sale = db.query(Sale).filter(Sale.id == item.sale_id).first()
                if sale:
                    sale_number = sale.sale_number
                    if sale.customer_id:
                        cust = db.query(Customer).filter(Customer.id == sale.customer_id).first()
                        if cust:
                            customer_name = cust.name

        ws, expiry, days = _compute_warranty_status(warranty_months, sn.sold_at, today)

        if status_filter and ws != status_filter:
            continue

        # Count open claims
        open_claims = db.query(func.count(WarrantyClaim.id)).filter(
            WarrantyClaim.serial_id == sn.id,
            WarrantyClaim.status.in_(["OPEN", "IN_REPAIR"]),
        ).scalar() or 0

        items_all.append(WarrantyStatusResponse(
            serial_id=sn.id,
            serial_number=sn.serial,
            product_name=product.name if product else None,
            variant_name=variant.name if variant else None,
            customer_name=customer_name,
            sale_number=sale_number,
            sold_at=sn.sold_at,
            warranty_months=warranty_months,
            expiry_date=expiry,
            warranty_status=ws,
            days_remaining=days,
            open_claims=open_claims,
        ))

    total = len(items_all)
    start = (page - 1) * per_page
    items = items_all[start: start + per_page]

    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total else 0,
    }


def get_warranty_unit(db: Session, serial_id: int, business_id: int) -> WarrantyStatusResponse:
    """Get warranty status for a single serial number."""
    today = datetime.now(timezone.utc).date()

    sn = db.query(SerialNumber).filter(
        SerialNumber.id == serial_id,
        SerialNumber.business_id == business_id,
    ).first()
    if not sn:
        raise HTTPException(status_code=404, detail="Serial number not found")

    variant = sn.variant
    product = variant.product if variant else None
    warranty_months = variant.warranty_months if variant else 0
    customer_name = None
    sale_number = None
    if sn.sale_item_id:
        item = db.query(SaleItem).filter(SaleItem.id == sn.sale_item_id).first()
        if item:
            if item.warranty_months is not None:
                warranty_months = item.warranty_months
            sale = db.query(Sale).filter(Sale.id == item.sale_id).first()
            if sale:
                sale_number = sale.sale_number
                if sale.customer_id:
                    cust = db.query(Customer).filter(Customer.id == sale.customer_id).first()
                    if cust:
                        customer_name = cust.name

    ws, expiry, days = _compute_warranty_status(warranty_months, sn.sold_at, today)

    open_claims = db.query(func.count(WarrantyClaim.id)).filter(
        WarrantyClaim.serial_id == sn.id,
        WarrantyClaim.status.in_(["OPEN", "IN_REPAIR"]),
    ).scalar() or 0

    return WarrantyStatusResponse(
        serial_id=sn.id,
        serial_number=sn.serial,
        product_name=product.name if product else None,
        variant_name=variant.name if variant else None,
        customer_name=customer_name,
        sale_number=sale_number,
        sold_at=sn.sold_at,
        warranty_months=warranty_months,
        expiry_date=expiry,
        warranty_status=ws,
        days_remaining=days,
        open_claims=open_claims,
    )


# ── Claims ────────────────────────────────────────────────────────────────────

def list_claims(
    db: Session,
    business_id: int,
    status: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    q = db.query(WarrantyClaim).filter(WarrantyClaim.business_id == business_id)
    if status:
        q = q.filter(WarrantyClaim.status == status.upper())
    total = q.count()
    claims = (
        q.order_by(WarrantyClaim.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )
    return {
        "items": [_build_claim_response(c) for c in claims],
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total else 0,
    }


def file_claim(
    db: Session,
    business_id: int,
    user_id: int,
    data: WarrantyClaimCreate,
) -> WarrantyClaim:
    """File a new warranty claim for a serial number."""
    today = datetime.now(timezone.utc).date()

    # Serial must belong to this business
    sn = db.query(SerialNumber).filter(
        SerialNumber.id == data.serial_id,
        SerialNumber.business_id == business_id,
    ).first()
    if not sn:
        raise HTTPException(status_code=404, detail="Serial number not found")

    # Must be sold
    if sn.status not in ("SOLD", "RETURNED", "WARRANTY"):
        raise HTTPException(status_code=422, detail=f"Serial is {sn.status} — cannot file warranty claim")

    # Check warranty hasn't expired
    variant = sn.variant
    warranty_months = variant.warranty_months if variant else 0
    if sn.sale_item_id:
        item = db.query(SaleItem).filter(SaleItem.id == sn.sale_item_id).first()
        if item and item.warranty_months is not None:
            warranty_months = item.warranty_months

    ws, expiry, _ = _compute_warranty_status(warranty_months, sn.sold_at, today)

    if ws == "NO_WARRANTY":
        raise HTTPException(status_code=422, detail="This product has no warranty")
    if ws == "EXPIRED":
        raise HTTPException(status_code=422, detail=f"Warranty expired on {expiry}")

    # Transition serial to WARRANTY status
    if sn.status == "SOLD":
        sn.status = "WARRANTY"

    claim = WarrantyClaim(
        business_id=business_id,
        serial_id=sn.id,
        customer_id=data.customer_id,
        claim_number=_next_claim_number(db, business_id),
        issue_desc=data.issue_desc,
        status="OPEN",
        claimed_by=user_id,
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)
    return claim


def update_claim(
    db: Session,
    claim_id: int,
    business_id: int,
    user_id: int,
    data: WarrantyClaimUpdate,
) -> WarrantyClaim:
    """Update claim status (IN_REPAIR, RESOLVED, REJECTED)."""
    claim = db.query(WarrantyClaim).filter(
        WarrantyClaim.id == claim_id,
        WarrantyClaim.business_id == business_id,
    ).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Warranty claim not found")

    if data.status:
        claim.status = data.status
        if data.status in ("RESOLVED", "REJECTED"):
            claim.resolved_by = user_id
            claim.resolved_at = datetime.now(timezone.utc)
            # If resolved, transition serial back to IN_STOCK
            if data.status == "RESOLVED" and claim.serial:
                sn = claim.serial
                if sn.status == "WARRANTY":
                    sn.status = "IN_STOCK"

    if data.resolution_note is not None:
        claim.resolution_note = data.resolution_note

    db.commit()
    db.refresh(claim)
    return claim
