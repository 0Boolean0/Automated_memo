"""
Warranty endpoints — Phase 10.

GET  /warranty/             → list sold serialized units with warranty status
GET  /warranty/{serial_id}  → warranty status for one serial
GET  /warranty/claims       → list warranty claims
POST /warranty/claims       → file a new claim
PUT  /warranty/claims/{id}  → update claim status (IN_REPAIR / RESOLVED / REJECTED)
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.auth.dependencies import require_permission
from app.models.user import User
from app.schemas.warranty import (
    WarrantyClaimCreate, WarrantyClaimUpdate,
    WarrantyClaimResponse, WarrantyStatusResponse,
)
from app.services import warranty_service

router = APIRouter()


@router.get("/", response_model=dict)
def list_warranty_units(
    status:   Optional[str] = Query(None, description="ACTIVE | EXPIRING | EXPIRED | NO_WARRANTY"),
    search:   Optional[str] = Query(None),
    page:     int           = Query(1,  ge=1),
    per_page: int           = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission("view_warranty")),
    db: Session = Depends(get_db),
):
    """List all sold serialized units with computed warranty status."""
    return warranty_service.list_warranty_units(
        db, current_user.business_id,
        status_filter=status, search=search,
        page=page, per_page=per_page,
    )


@router.get("/claims", response_model=dict)
def list_claims(
    status:   Optional[str] = Query(None),
    page:     int           = Query(1,  ge=1),
    per_page: int           = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission("view_warranty")),
    db: Session = Depends(get_db),
):
    """List warranty claims with optional status filter."""
    return warranty_service.list_claims(
        db, current_user.business_id,
        status=status, page=page, per_page=per_page,
    )


@router.post("/claims", response_model=WarrantyClaimResponse, status_code=201)
def file_claim(
    data: WarrantyClaimCreate,
    current_user: User = Depends(require_permission("manage_warranty")),
    db: Session = Depends(get_db),
):
    """
    File a warranty claim for a sold serial number.
    Validates warranty is still active before filing.
    Transitions the serial to WARRANTY status.
    """
    claim = warranty_service.file_claim(
        db, current_user.business_id, current_user.id, data
    )
    return warranty_service._build_claim_response(claim)


@router.put("/claims/{claim_id}", response_model=WarrantyClaimResponse)
def update_claim(
    claim_id: int,
    data: WarrantyClaimUpdate,
    current_user: User = Depends(require_permission("manage_warranty")),
    db: Session = Depends(get_db),
):
    """
    Update claim status.
    RESOLVED → serial transitions back to IN_STOCK.
    """
    claim = warranty_service.update_claim(
        db, claim_id, current_user.business_id, current_user.id, data
    )
    return warranty_service._build_claim_response(claim)


@router.get("/{serial_id}", response_model=WarrantyStatusResponse)
def get_warranty_unit(
    serial_id: int,
    current_user: User = Depends(require_permission("view_warranty")),
    db: Session = Depends(get_db),
):
    """Get warranty status for a single serial number."""
    return warranty_service.get_warranty_unit(db, serial_id, current_user.business_id)
