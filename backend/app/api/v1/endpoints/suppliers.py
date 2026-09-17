"""Supplier endpoints."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.auth.dependencies import get_current_user, require_permission
from app.models.user import User
from app.schemas.supplier import SupplierCreate, SupplierUpdate, SupplierResponse, SupplierListResponse
from app.services import supplier_service

router = APIRouter()


@router.get("/", response_model=dict)
def list_suppliers(
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_permission("view_suppliers")),
    db: Session = Depends(get_db),
):
    return supplier_service.list_suppliers(db, current_user.business_id, search=search, page=page, per_page=per_page)


@router.post("/", response_model=SupplierResponse, status_code=201)
def create_supplier(
    data: SupplierCreate,
    current_user: User = Depends(require_permission("manage_suppliers")),
    db: Session = Depends(get_db),
):
    supplier = supplier_service.create_supplier(db, current_user.business_id, data)
    return supplier_service.build_supplier_response(db, supplier)


@router.get("/{supplier_id}", response_model=SupplierResponse)
def get_supplier(
    supplier_id: int,
    current_user: User = Depends(require_permission("view_suppliers")),
    db: Session = Depends(get_db),
):
    supplier = supplier_service.get_supplier(db, supplier_id, current_user.business_id)
    return supplier_service.build_supplier_response(db, supplier)


@router.put("/{supplier_id}", response_model=SupplierResponse)
def update_supplier(
    supplier_id: int,
    data: SupplierUpdate,
    current_user: User = Depends(require_permission("manage_suppliers")),
    db: Session = Depends(get_db),
):
    supplier = supplier_service.update_supplier(db, supplier_id, current_user.business_id, data)
    return supplier_service.build_supplier_response(db, supplier)
