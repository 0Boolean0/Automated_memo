"""
Product & Variant endpoints.

GET    /products                  → paginated list with search/filter
POST   /products                  → create product + variants
GET    /products/{id}             → full product detail with variants
PUT    /products/{id}             → update product info
DELETE /products/{id}             → soft delete
POST   /products/{id}/variants    → add variant to product
PUT    /variants/{id}             → update variant (records price history)
GET    /variants/{id}/price-history → audit trail of price changes
"""

from fastapi import APIRouter, Depends, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.auth.dependencies import get_current_user, require_permission
from app.models.user import User
from app.schemas.product import (
    ProductCreate, ProductUpdate, ProductResponse,
    ProductListResponse, PaginatedProducts,
    VariantCreate, VariantUpdate, VariantResponse,
    PriceHistoryResponse, InStockProductItem,
    QuickLookupResult, ScanImageResponse,
)
from app.services import product_service

router = APIRouter()


@router.get("/", response_model=PaginatedProducts)
def list_products(
    search:      Optional[str]  = Query(None),
    category_id: Optional[int]  = Query(None),
    brand_id:    Optional[int]  = Query(None),
    is_active:   Optional[bool] = Query(True),
    page:        int            = Query(1, ge=1),
    per_page:    int            = Query(20, ge=1, le=500),
    current_user: User = Depends(require_permission("view_products")),
    db: Session = Depends(get_db),
):
    return product_service.list_products(
        db, current_user.business_id,
        search=search, category_id=category_id, brand_id=brand_id,
        is_active=is_active, page=page, per_page=per_page,
    )


@router.post("/", response_model=ProductResponse, status_code=201)
def create_product(
    data: ProductCreate,
    current_user: User = Depends(require_permission("create_product")),
    db: Session = Depends(get_db),
):
    product = product_service.create_product(
        db, current_user.business_id, current_user.id, data
    )
    return product_service._build_product_response(product)


@router.get("/scan", tags=["products"])
def scan_product(
    barcode: Optional[str] = Query(None),
    sku:     Optional[str] = Query(None),
    serial:  Optional[str] = Query(None),
    current_user: User = Depends(require_permission("view_products")),
    db: Session = Depends(get_db),
):
    """
    Look up a product variant by barcode, SKU, or serial number.
    Used by the barcode scanner page and POS.
    """
    return product_service.lookup_by_scan(
        db, current_user.business_id, barcode=barcode, sku=sku, serial=serial
    )


@router.get("/in-stock-catalog", response_model=list[InStockProductItem], tags=["products"])
def get_in_stock_catalog(
    current_user: User = Depends(require_permission("view_products")),
    db: Session = Depends(get_db),
):
    """
    Get all active products and variants that have current_stock > 0,
    along with their available in-stock serial numbers.
    """
    return product_service.get_in_stock_catalog(db, current_user.business_id)


@router.get("/quick-lookup", response_model=list[QuickLookupResult], tags=["products"])
def quick_lookup(
    q: str = Query(..., min_length=1, description="Serial, barcode, SKU, or name search"),
    current_user: User = Depends(require_permission("view_products")),
    db: Session = Depends(get_db),
):
    """
    Quick search across serial numbers, barcodes, SKUs, and product names.
    Returns matching variants with auto-detected match_type and matched_serial.
    """
    return product_service.lookup_by_query(db, current_user.business_id, q)


@router.post("/scan-image", response_model=ScanImageResponse, tags=["products"])
async def scan_image(
    file: UploadFile = File(...),
    current_user: User = Depends(require_permission("view_products")),
    db: Session = Depends(get_db),
):
    """
    Upload an image of a serial number sticker, barcode, or label.
    Extracts text using OCR and matches against in-stock products and serials.
    """
    image_bytes = await file.read()
    return product_service.scan_image_for_code(db, current_user.business_id, image_bytes)


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    current_user: User = Depends(require_permission("view_products")),
    db: Session = Depends(get_db),
):
    product = product_service.get_product(db, product_id, current_user.business_id)
    return product_service._build_product_response(product)


@router.put("/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    data: ProductUpdate,
    current_user: User = Depends(require_permission("edit_product")),
    db: Session = Depends(get_db),
):
    product = product_service.update_product(
        db, product_id, current_user.business_id, data
    )
    return product_service._build_product_response(product)


@router.delete("/{product_id}", status_code=204)
def delete_product(
    product_id: int,
    current_user: User = Depends(require_permission("delete_product")),
    db: Session = Depends(get_db),
):
    product_service.delete_product(db, product_id, current_user.business_id)


# ─── Variant sub-routes ───────────────────────────────────────────────────────

@router.post("/{product_id}/variants", response_model=VariantResponse, status_code=201)
def add_variant(
    product_id: int,
    data: VariantCreate,
    current_user: User = Depends(require_permission("edit_product")),
    db: Session = Depends(get_db),
):
    return product_service.add_variant(
        db, product_id, current_user.business_id, data, current_user.id
    )


@router.put("/variants/{variant_id}", response_model=VariantResponse)
def update_variant(
    variant_id: int,
    data: VariantUpdate,
    current_user: User = Depends(require_permission("edit_product")),
    db: Session = Depends(get_db),
):
    return product_service.update_variant(
        db, variant_id, current_user.business_id, data, current_user.id
    )


@router.get("/variants/{variant_id}/price-history", response_model=list[PriceHistoryResponse])
def get_price_history(
    variant_id: int,
    current_user: User = Depends(require_permission("view_products")),
    db: Session = Depends(get_db),
):
    return product_service.get_variant_price_history(
        db, variant_id, current_user.business_id
    )


@router.get("/variants/{variant_id}/serials/in-stock", response_model=list[str])
def get_in_stock_serials(
    variant_id: int,
    current_user: User = Depends(require_permission("view_products")),
    db: Session = Depends(get_db),
):
    from app.models.serial import SerialNumber
    serials = db.query(SerialNumber.serial).filter(
        SerialNumber.variant_id == variant_id,
        SerialNumber.business_id == current_user.business_id,
        SerialNumber.status == "IN_STOCK",
    ).order_by(SerialNumber.id.asc()).all()
    return [s[0] for s in serials]

