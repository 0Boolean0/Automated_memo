"""Supplier service — CRUD for suppliers and contacts."""

from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.supplier import Supplier, SupplierContact
from app.models.purchase import Purchase
from app.schemas.supplier import SupplierCreate, SupplierUpdate, SupplierResponse, SupplierListResponse
import math


def list_suppliers(db: Session, business_id: int, search: str | None = None,
                   page: int = 1, per_page: int = 50):
    q = db.query(Supplier).filter(Supplier.business_id == business_id, Supplier.is_active == True)
    if search:
        q = q.filter(Supplier.name.ilike(f"%{search}%"))
    total = q.count()
    suppliers = q.order_by(Supplier.name).offset((page - 1) * per_page).limit(per_page).all()

    items = []
    for s in suppliers:
        count = db.query(Purchase).filter(Purchase.supplier_id == s.id).count()
        items.append(SupplierListResponse(
            id=s.id, name=s.name, company=s.company, phone=s.phone,
            is_active=s.is_active, purchase_count=count, created_at=s.created_at,
        ))
    return {"items": items, "total": total, "page": page, "per_page": per_page,
            "pages": math.ceil(total / per_page) if total else 0}


def get_supplier(db: Session, supplier_id: int, business_id: int) -> Supplier:
    s = db.query(Supplier).filter(Supplier.id == supplier_id, Supplier.business_id == business_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return s


def create_supplier(db: Session, business_id: int, data: SupplierCreate) -> Supplier:
    supplier = Supplier(
        business_id=business_id,
        name=data.name, company=data.company, phone=data.phone,
        email=data.email, address=data.address, notes=data.notes,
    )
    db.add(supplier)
    db.flush()
    for c in data.contacts:
        db.add(SupplierContact(supplier_id=supplier.id, **c.model_dump()))
    db.commit()
    db.refresh(supplier)
    return supplier


def update_supplier(db: Session, supplier_id: int, business_id: int, data: SupplierUpdate) -> Supplier:
    supplier = get_supplier(db, supplier_id, business_id)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(supplier, k, v)
    db.commit()
    db.refresh(supplier)
    return supplier


def build_supplier_response(db: Session, supplier: Supplier) -> SupplierResponse:
    count = db.query(Purchase).filter(Purchase.supplier_id == supplier.id).count()
    return SupplierResponse(
        id=supplier.id, business_id=supplier.business_id,
        name=supplier.name, company=supplier.company, phone=supplier.phone,
        email=supplier.email, address=supplier.address, notes=supplier.notes,
        is_active=supplier.is_active, created_at=supplier.created_at,
        contacts=supplier.contacts, purchase_count=count,
    )
