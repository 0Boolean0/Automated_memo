"""
Purchase endpoints.

POST /purchases/         → receive stock (creates purchase + serials + updates stock)
GET  /purchases/         → paginated list
GET  /purchases/{id}     → full detail with items and serial count
GET  /purchases/{id}/serials → list all serials registered in a purchase
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.auth.dependencies import get_current_user, require_permission
from app.models.user import User
from app.models.serial import SerialNumber
from app.schemas.purchase import PurchaseCreate, PurchaseResponse, PaginatedPurchases
from app.services import purchase_service

router = APIRouter()


@router.post("/", response_model=PurchaseResponse, status_code=201)
def receive_stock(
    data: PurchaseCreate,
    current_user: User = Depends(require_permission("receive_stock")),
    db: Session = Depends(get_db),
):
    """
    Receive stock from a supplier.
    Creates the purchase, purchase items, serial numbers, and updates inventory.
    All-or-nothing — if anything fails, nothing is saved.
    """
    purchase = purchase_service.receive_stock(db, current_user.business_id, current_user.id, data)
    return purchase_service._build_response(db, purchase)


@router.get("/", response_model=PaginatedPurchases)
def list_purchases(
    supplier_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission("view_purchases")),
    db: Session = Depends(get_db),
):
    return purchase_service.list_purchases(
        db, current_user.business_id,
        supplier_id=supplier_id, page=page, per_page=per_page,
    )


@router.get("/{purchase_id}", response_model=PurchaseResponse)
def get_purchase(
    purchase_id: int,
    current_user: User = Depends(require_permission("view_purchases")),
    db: Session = Depends(get_db),
):
    purchase = purchase_service.get_purchase(db, purchase_id, current_user.business_id)
    return purchase_service._build_response(db, purchase)


@router.get("/{purchase_id}/serials")
def list_purchase_serials(
    purchase_id: int,
    current_user: User = Depends(require_permission("view_inventory")),
    db: Session = Depends(get_db),
):
    """List all serial numbers registered under a purchase."""
    purchase = purchase_service.get_purchase(db, purchase_id, current_user.business_id)
    serials = []
    for item in purchase.items:
        item_serials = (
            db.query(SerialNumber)
            .filter(SerialNumber.purchase_item_id == item.id)
            .all()
        )
        for sn in item_serials:
            serials.append({
                "id": sn.id,
                "serial": sn.serial,
                "status": sn.status,
                "variant_id": sn.variant_id,
                "variant_name": item.variant.name if item.variant else None,
                "cost_price": float(sn.cost_price) if sn.cost_price else None,
                "received_at": sn.received_at.isoformat() if sn.received_at else None,
            })
    return {"purchase_id": purchase_id, "serial_count": len(serials), "serials": serials}
