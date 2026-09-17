"""
Category & Brand endpoints.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.auth.dependencies import get_current_user, require_permission
from app.models.user import User
from app.schemas.product import (
    CategoryCreate, CategoryUpdate, CategoryResponse,
    BrandCreate, BrandUpdate, BrandResponse,
)
from app.services import product_service

router = APIRouter()

# ─── Categories ──────────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryResponse])
def list_categories(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return product_service.list_categories(db, current_user.business_id)

@router.post("/categories", response_model=CategoryResponse, status_code=201)
def create_category(
    data: CategoryCreate,
    current_user: User = Depends(require_permission("create_product")),
    db: Session = Depends(get_db),
):
    return product_service.create_category(db, current_user.business_id, data)

@router.put("/categories/{cat_id}", response_model=CategoryResponse)
def update_category(
    cat_id: int,
    data: CategoryUpdate,
    current_user: User = Depends(require_permission("edit_product")),
    db: Session = Depends(get_db),
):
    return product_service.update_category(db, cat_id, current_user.business_id, data)

@router.delete("/categories/{cat_id}", status_code=204)
def delete_category(
    cat_id: int,
    current_user: User = Depends(require_permission("edit_product")),
    db: Session = Depends(get_db),
):
    product_service.delete_category(db, cat_id, current_user.business_id)


# ─── Brands ──────────────────────────────────────────────────────────────────

@router.get("/brands", response_model=list[BrandResponse])
def list_brands(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return product_service.list_brands(db, current_user.business_id)

@router.post("/brands", response_model=BrandResponse, status_code=201)
def create_brand(
    data: BrandCreate,
    current_user: User = Depends(require_permission("create_product")),
    db: Session = Depends(get_db),
):
    return product_service.create_brand(db, current_user.business_id, data)

@router.put("/brands/{brand_id}", response_model=BrandResponse)
def update_brand(
    brand_id: int,
    data: BrandUpdate,
    current_user: User = Depends(require_permission("edit_product")),
    db: Session = Depends(get_db),
):
    return product_service.update_brand(db, brand_id, current_user.business_id, data)

@router.delete("/brands/{brand_id}", status_code=204)
def delete_brand(
    brand_id: int,
    current_user: User = Depends(require_permission("edit_product")),
    db: Session = Depends(get_db),
):
    product_service.delete_brand(db, brand_id, current_user.business_id)
