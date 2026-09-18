"""
Returns endpoints — Phase 11.

POST /returns/              → create a return (transitions serials, restores stock)
GET  /returns/              → paginated list
GET  /returns/{id}          → full return detail with items
PUT  /returns/{id}/refund   → update refund status
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.auth.dependencies import require_permission
from app.models.user import User
from app.schemas.return_ import (
    ReturnCreate, ReturnResponse, RefundStatusUpdate,
)
from app.services import return_service

router = APIRouter()


@router.post("/", response_model=ReturnResponse, status_code=201)
def create_return(
    data: ReturnCreate,
    current_user: User = Depends(require_permission("manage_returns")),
    db: Session = Depends(get_db),
):
    """
    Process a customer return. Atomically:
    - GOOD items: serial → IN_STOCK, stock incremented
    - DAMAGED items: serial → DAMAGED, stock unchanged
    - Creates Return + ReturnItem records
    """
    ret = return_service.create_return(
        db, current_user.business_id, current_user.id, data
    )
    return return_service._build_response(ret)


@router.get("/", response_model=dict)
def list_returns(
    sale_id:     Optional[int] = Query(None),
    customer_id: Optional[int] = Query(None),
    page:        int           = Query(1,  ge=1),
    per_page:    int           = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission("view_returns")),
    db: Session = Depends(get_db),
):
    return return_service.list_returns(
        db, current_user.business_id,
        sale_id=sale_id, customer_id=customer_id,
        page=page, per_page=per_page,
    )


@router.get("/{return_id}", response_model=ReturnResponse)
def get_return(
    return_id: int,
    current_user: User = Depends(require_permission("view_returns")),
    db: Session = Depends(get_db),
):
    ret = return_service.get_return(db, return_id, current_user.business_id)
    return return_service._build_response(ret)


@router.put("/{return_id}/refund", response_model=ReturnResponse)
def update_refund_status(
    return_id: int,
    data: RefundStatusUpdate,
    current_user: User = Depends(require_permission("manage_returns")),
    db: Session = Depends(get_db),
):
    """Update refund status: PENDING → ISSUED | EXCHANGE | NONE"""
    ret = return_service.update_refund_status(
        db, return_id, current_user.business_id, data
    )
    return return_service._build_response(ret)
