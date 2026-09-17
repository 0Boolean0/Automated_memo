"""
Sale service — Phase 8.

SELL FLOW:
    1. Pre-validate all items (variants exist, stock available, serials IN_STOCK)
    2. Create Sale record
    3. For each item: create SaleItem
    4. For serialized variants: look up each SerialNumber, transition to SOLD,
       set sold_at and sale_item_id
    5. For non-serialized: decrement variant.current_stock
    6. Compute totals, apply discount + loyalty redemption, set payment_status
    7. Update customer loyalty points (if customer linked)
    8. Commit everything atomically (all-or-nothing)

No partial sales. If anything fails, the entire transaction is rolled back.
"""

import math
from datetime import datetime, timezone, date
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException

from app.models.sale import Sale, SaleItem
from app.models.product import ProductVariant, Product
from app.models.serial import SerialNumber
from app.models.customer import Customer
from app.schemas.sale import (
    SaleCreate, SaleResponse, SaleListResponse, SaleItemResponse,
)


# ─── Sale number generator ────────────────────────────────────────────────────

def _next_sale_number(db: Session, business_id: int) -> str:
    """Generate sequential sale number: SO-2026-00001"""
    year = datetime.now(timezone.utc).year
    count = db.query(func.count(Sale.id)).filter(
        Sale.business_id == business_id
    ).scalar() or 0
    return f"SO-{year}-{count + 1:05d}"


# ─── Response builder ─────────────────────────────────────────────────────────

def _build_response(db: Session, sale: Sale) -> SaleResponse:
    items_out = []
    for item in sale.items:
        serial_count = db.query(func.count(SerialNumber.id)).filter(
            SerialNumber.sale_item_id == item.id
        ).scalar() or 0
        variant = item.variant
        product = variant.product if variant else None
        items_out.append(SaleItemResponse(
            id=item.id,
            variant_id=item.variant_id,
            variant_name=variant.name if variant else None,
            product_name=product.name if product else None,
            sku=variant.sku if variant else None,
            quantity=item.quantity,
            unit_price=item.unit_price,
            discount_amount=item.discount_amount,
            total_price=item.total_price,
            notes=item.notes,
            serial_count=serial_count,
        ))

    customer = sale.customer
    return SaleResponse(
        id=sale.id,
        business_id=sale.business_id,
        customer_id=sale.customer_id,
        customer_name=customer.name if customer else None,
        customer_phone=customer.phone if customer else None,
        sale_number=sale.sale_number,
        sale_date=sale.sale_date,
        total_amount=sale.total_amount,
        discount_amount=sale.discount_amount,
        loyalty_points_redeemed=sale.loyalty_points_redeemed,
        loyalty_points_earned=sale.loyalty_points_earned,
        paid_amount=sale.paid_amount,
        net_payable=sale.net_payable,
        due_amount=sale.due_amount,
        payment_status=sale.payment_status,
        notes=sale.notes,
        created_at=sale.created_at,
        items=items_out,
    )


# ─── Main sell function ───────────────────────────────────────────────────────

def sell(
    db: Session,
    business_id: int,
    user_id: int,
    data: SaleCreate,
) -> Sale:
    """
    Atomically create a sale, decrement stock, transition serials to SOLD.
    """
    now = datetime.now(timezone.utc)

    # ── Validate customer ──────────────────────────────────────────────────
    customer: Customer | None = None
    if data.customer_id:
        customer = db.query(Customer).filter(
            Customer.id == data.customer_id,
            Customer.business_id == business_id,
            Customer.is_active == True,
        ).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        # Validate enough loyalty points
        if data.loyalty_points_redeemed > customer.loyalty_points:
            raise HTTPException(
                status_code=422,
                detail=f"Customer only has {customer.loyalty_points} loyalty points",
            )

    # ── Pre-validate all items ─────────────────────────────────────────────
    validated_items: list[tuple] = []   # (item_data, variant, list[SerialNumber])

    for item_data in data.items:
        variant: ProductVariant | None = (
            db.query(ProductVariant)
            .join(Product)
            .filter(
                ProductVariant.id == item_data.variant_id,
                Product.business_id == business_id,
                ProductVariant.is_active == True,
            )
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

            serial_values = [s.serial.strip() for s in item_data.serials]

            # No intra-request duplicates
            if len(serial_values) != len(set(serial_values)):
                raise HTTPException(
                    status_code=409,
                    detail=f"Variant '{variant.name}': duplicate serial numbers in request",
                )

            # All serials must exist, belong to this business+variant, and be IN_STOCK
            serial_objs: list[SerialNumber] = []
            for serial_str in serial_values:
                sn = db.query(SerialNumber).filter(
                    SerialNumber.serial == serial_str,
                    SerialNumber.business_id == business_id,
                    SerialNumber.variant_id == variant.id,
                ).first()
                if not sn:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Serial '{serial_str}' not found in this business",
                    )
                if sn.status not in ("IN_STOCK", "RESERVED"):
                    raise HTTPException(
                        status_code=422,
                        detail=f"Serial '{serial_str}' is {sn.status} — cannot sell",
                    )
                serial_objs.append(sn)

            validated_items.append((item_data, variant, serial_objs))

        else:
            # Non-serialized: check sufficient stock
            if variant.current_stock < item_data.quantity:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        f"Variant '{variant.name}': only {variant.current_stock} in stock, "
                        f"requested {item_data.quantity}"
                    ),
                )
            validated_items.append((item_data, variant, []))

    # ── Create Sale ────────────────────────────────────────────────────────
    sale = Sale(
        business_id=business_id,
        customer_id=data.customer_id,
        sale_number=_next_sale_number(db, business_id),
        sale_date=data.sale_date,
        discount_amount=data.discount_amount,
        loyalty_points_redeemed=data.loyalty_points_redeemed,
        paid_amount=data.paid_amount,
        notes=data.notes,
        created_by=user_id,
    )
    db.add(sale)
    db.flush()  # get sale.id

    grand_total = Decimal("0")

    # ── Process each item ──────────────────────────────────────────────────
    for item_data, variant, serial_objs in validated_items:
        is_serialized = variant.product.is_serialized

        # Freeze the selling price at sale time
        unit_price = item_data.unit_price if item_data.unit_price is not None \
            else variant.selling_price
        line_discount = item_data.discount_amount
        line_total = (unit_price - line_discount) * item_data.quantity

        sale_item = SaleItem(
            sale_id=sale.id,
            variant_id=variant.id,
            quantity=item_data.quantity,
            unit_price=unit_price,
            discount_amount=line_discount,
            total_price=line_total,
            notes=item_data.notes,
        )
        db.add(sale_item)
        db.flush()  # get sale_item.id

        if is_serialized:
            for sn in serial_objs:
                sn.status = "SOLD"
                sn.sold_at = now
                sn.sale_item_id = sale_item.id
        else:
            variant.current_stock -= item_data.quantity

        grand_total += line_total

    # ── Finalize Sale ──────────────────────────────────────────────────────
    sale.total_amount = grand_total

    # Payment status based on net payable (after discount + loyalty)
    loyalty_value = Decimal(str(data.loyalty_points_redeemed)) * Decimal("0.10")
    net_payable = max(Decimal("0"), grand_total - data.discount_amount - loyalty_value)
    paid = data.paid_amount

    if paid >= net_payable:
        sale.payment_status = "PAID"
    elif paid > 0:
        sale.payment_status = "PARTIAL"
    else:
        sale.payment_status = "DUE"

    # ── Loyalty points ────────────────────────────────────────────────────
    # Earn 1 point per ৳100 of net sale value
    earned = max(0, int(float(net_payable) / 100))
    sale.loyalty_points_earned = earned

    if customer:
        customer.loyalty_points = customer.loyalty_points - data.loyalty_points_redeemed + earned

    db.commit()
    db.refresh(sale)
    return sale


# ─── List + Get ───────────────────────────────────────────────────────────────

def list_sales(
    db: Session,
    business_id: int,
    customer_id: int | None = None,
    payment_status: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> dict:
    q = db.query(Sale).filter(Sale.business_id == business_id)
    if customer_id:
        q = q.filter(Sale.customer_id == customer_id)
    if payment_status:
        q = q.filter(Sale.payment_status == payment_status.upper())

    total = q.count()
    sales = (
        q.order_by(Sale.sale_date.desc(), Sale.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    items = []
    for s in sales:
        items.append(SaleListResponse(
            id=s.id,
            sale_number=s.sale_number,
            customer_name=s.customer.name if s.customer else None,
            sale_date=s.sale_date,
            total_amount=s.total_amount,
            paid_amount=s.paid_amount,
            net_payable=s.net_payable,
            due_amount=s.due_amount,
            payment_status=s.payment_status,
            item_count=len(s.items),
            created_at=s.created_at,
        ))

    return {
        "items": items, "total": total, "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total else 0,
    }


def get_sale(db: Session, sale_id: int, business_id: int) -> Sale:
    s = db.query(Sale).filter(
        Sale.id == sale_id, Sale.business_id == business_id
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Sale not found")
    return s
