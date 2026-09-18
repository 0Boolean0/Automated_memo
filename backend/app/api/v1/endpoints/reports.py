"""
Reports endpoints — Phase 12.

GET /reports/summary       → dashboard stats: today sales/revenue, totals, recent sales
GET /reports/sales-chart   → daily revenue for last N days (default 30)
GET /reports/top-products  → top N variants by quantity sold (default 10)
GET /reports/inventory     → stock value by category + low-stock count
"""

from datetime import datetime, timezone, timedelta, date
from decimal import Decimal
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, Date as SQLDate
from fastapi import APIRouter, Depends, Query
from typing import Optional

from app.core.database import get_db
from app.auth.dependencies import require_permission
from app.models.user import User
from app.models.sale import Sale, SaleItem
from app.models.purchase import Purchase
from app.models.product import ProductVariant, Product, Category
from app.models.serial import SerialNumber
from app.models.inventory import InventoryAdjustment
from app.models.warranty import WarrantyClaim
from app.models.return_ import Return

router = APIRouter()


@router.get("/summary")
def get_summary(
    current_user: User = Depends(require_permission("view_reports")),
    db: Session = Depends(get_db),
):
    """
    Dashboard summary stats:
    - today_sales:       number of sales today
    - today_revenue:     net revenue today (sum of net_payable approximated as total - discount)
    - total_sales:       all-time sale count
    - total_revenue:     all-time revenue
    - total_products:    active product count
    - total_variants:    active variant count
    - low_stock_count:   variants below reorder level
    - active_warranties: open warranty claims (OPEN + IN_REPAIR)
    - pending_returns:   returns with PENDING refund
    - recent_sales:      last 5 sales with customer name and amount
    """
    biz = current_user.business_id
    today = datetime.now(timezone.utc).date()

    # Today sales
    today_q = db.query(Sale).filter(
        Sale.business_id == biz,
        cast(Sale.sale_date, SQLDate) == today,
    )
    today_sales = today_q.count()
    today_revenue = db.query(
        func.coalesce(func.sum(Sale.total_amount - Sale.discount_amount), 0)
    ).filter(
        Sale.business_id == biz,
        cast(Sale.sale_date, SQLDate) == today,
    ).scalar() or 0

    # All-time
    total_sales = db.query(func.count(Sale.id)).filter(Sale.business_id == biz).scalar() or 0
    total_revenue = db.query(
        func.coalesce(func.sum(Sale.total_amount - Sale.discount_amount), 0)
    ).filter(Sale.business_id == biz).scalar() or 0

    # Products / variants
    total_products = db.query(func.count(Product.id)).filter(
        Product.business_id == biz, Product.is_active == True
    ).scalar() or 0
    total_variants = db.query(func.count(ProductVariant.id)).join(Product).filter(
        Product.business_id == biz, ProductVariant.is_active == True
    ).scalar() or 0

    # Low stock
    low_stock_count = db.query(func.count(ProductVariant.id)).join(Product).filter(
        Product.business_id == biz,
        ProductVariant.is_active == True,
        ProductVariant.current_stock < ProductVariant.reorder_level,
    ).scalar() or 0

    # Active warranty claims
    active_warranties = db.query(func.count(WarrantyClaim.id)).filter(
        WarrantyClaim.business_id == biz,
        WarrantyClaim.status.in_(["OPEN", "IN_REPAIR"]),
    ).scalar() or 0

    # Pending returns
    pending_returns = db.query(func.count(Return.id)).filter(
        Return.business_id == biz,
        Return.refund_status == "PENDING",
    ).scalar() or 0

    # Recent 5 sales
    recent_sales_rows = (
        db.query(Sale)
        .filter(Sale.business_id == biz)
        .order_by(Sale.sale_date.desc(), Sale.id.desc())
        .limit(5)
        .all()
    )
    recent_sales = [
        {
            "id": s.id,
            "sale_number": s.sale_number,
            "sale_date": str(s.sale_date),
            "customer_name": s.customer.name if s.customer else None,
            "total_amount": float(s.total_amount),
            "net_payable": s.net_payable,
            "payment_status": s.payment_status,
        }
        for s in recent_sales_rows
    ]

    return {
        "today_sales":      today_sales,
        "today_revenue":    float(today_revenue),
        "total_sales":      total_sales,
        "total_revenue":    float(total_revenue),
        "total_products":   total_products,
        "total_variants":   total_variants,
        "low_stock_count":  low_stock_count,
        "active_warranties":active_warranties,
        "pending_returns":  pending_returns,
        "recent_sales":     recent_sales,
    }


@router.get("/sales-chart")
def get_sales_chart(
    days: int = Query(30, ge=7, le=365),
    current_user: User = Depends(require_permission("view_reports")),
    db: Session = Depends(get_db),
):
    """
    Daily revenue for the last N days.
    Returns a list of {date, revenue, sales_count} objects, one per day,
    filling in zero for days with no sales (so charts have no gaps).
    """
    biz   = current_user.business_id
    today = datetime.now(timezone.utc).date()
    start = today - timedelta(days=days - 1)

    # Query aggregated daily sales
    rows = (
        db.query(
            cast(Sale.sale_date, SQLDate).label("day"),
            func.count(Sale.id).label("sales_count"),
            func.coalesce(
                func.sum(Sale.total_amount - Sale.discount_amount), 0
            ).label("revenue"),
        )
        .filter(
            Sale.business_id == biz,
            Sale.sale_date >= start,
            Sale.sale_date <= today,
        )
        .group_by(cast(Sale.sale_date, SQLDate))
        .all()
    )

    # Build lookup {date_str: row}
    by_date = {str(r.day): r for r in rows}

    # Fill every day in range
    result = []
    d = start
    while d <= today:
        ds = str(d)
        row = by_date.get(ds)
        result.append({
            "date":        ds,
            "revenue":     float(row.revenue) if row else 0.0,
            "sales_count": int(row.sales_count) if row else 0,
        })
        d += timedelta(days=1)

    return {"days": days, "data": result}


@router.get("/top-products")
def get_top_products(
    limit: int = Query(10, ge=1, le=50),
    days: Optional[int] = Query(None, description="Restrict to last N days; None = all time"),
    current_user: User = Depends(require_permission("view_reports")),
    db: Session = Depends(get_db),
):
    """
    Top N product variants by quantity sold.
    Returns variant name, product name, quantity sold, and revenue.
    """
    biz = current_user.business_id

    q = (
        db.query(
            SaleItem.variant_id,
            func.sum(SaleItem.quantity).label("qty_sold"),
            func.sum(SaleItem.total_price).label("revenue"),
        )
        .join(Sale, SaleItem.sale_id == Sale.id)
        .filter(Sale.business_id == biz)
    )

    if days:
        cutoff = datetime.now(timezone.utc).date() - timedelta(days=days)
        q = q.filter(Sale.sale_date >= cutoff)

    rows = (
        q.group_by(SaleItem.variant_id)
        .order_by(func.sum(SaleItem.quantity).desc())
        .limit(limit)
        .all()
    )

    result = []
    for row in rows:
        variant = db.query(ProductVariant).filter(ProductVariant.id == row.variant_id).first()
        product = variant.product if variant else None
        result.append({
            "variant_id":   row.variant_id,
            "variant_name": variant.name if variant else "—",
            "product_name": product.name if product else "—",
            "sku":          variant.sku if variant else None,
            "qty_sold":     int(row.qty_sold),
            "revenue":      float(row.revenue),
        })

    return {"limit": limit, "days": days, "data": result}


@router.get("/inventory")
def get_inventory_report(
    current_user: User = Depends(require_permission("view_reports")),
    db: Session = Depends(get_db),
):
    """
    Inventory summary:
    - total_stock_value (cost_price × current_stock across all active variants)
    - total_retail_value (selling_price × current_stock)
    - by_category: [{name, stock, cost_value, retail_value}]
    - recent_adjustments: last 5 inventory adjustments
    """
    biz = current_user.business_id

    variants = (
        db.query(ProductVariant)
        .join(Product)
        .filter(Product.business_id == biz, ProductVariant.is_active == True)
        .all()
    )

    total_cost   = 0.0
    total_retail = 0.0
    by_cat: dict[str, dict] = defaultdict(lambda: {"stock": 0, "cost_value": 0.0, "retail_value": 0.0})

    for v in variants:
        product = v.product
        cat = product.category.name if product.category else "Uncategorized"
        stock = v.current_stock
        cost  = float(v.cost_price) * stock
        retail= float(v.selling_price) * stock
        total_cost   += cost
        total_retail += retail
        by_cat[cat]["stock"]        += stock
        by_cat[cat]["cost_value"]   += cost
        by_cat[cat]["retail_value"] += retail

    # Recent adjustments
    adj_rows = (
        db.query(InventoryAdjustment)
        .filter(InventoryAdjustment.business_id == biz)
        .order_by(InventoryAdjustment.created_at.desc())
        .limit(5)
        .all()
    )
    recent_adjustments = [
        {
            "id": a.id,
            "adjustment_type": a.adjustment_type.value if hasattr(a.adjustment_type, 'value') else str(a.adjustment_type),
            "quantity_change": a.quantity_change,
            "reason": a.reason,
            "created_at": a.created_at.isoformat() if a.created_at else None,
        }
        for a in adj_rows
    ]

    return {
        "total_stock_value":  round(total_cost,   2),
        "total_retail_value": round(total_retail, 2),
        "by_category": [
            {"name": k, **v} for k, v in sorted(by_cat.items(), key=lambda x: -x[1]["stock"])
        ],
        "recent_adjustments": recent_adjustments,
    }
