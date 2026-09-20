"""
Product service — business logic for categories, brands, products, variants.
"""

from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from fastapi import HTTPException

from app.models.product import Category, Brand, Product, ProductVariant, PriceHistory
from app.models.serial import SerialNumber
from app.models.inventory import InventoryAdjustment, AdjustmentType
from app.schemas.product import (
    CategoryCreate, CategoryUpdate,
    BrandCreate, BrandUpdate,
    ProductCreate, ProductUpdate,
    VariantCreate, VariantUpdate,
    ProductResponse, ProductListResponse, VariantResponse,
)


# ─── Category ────────────────────────────────────────────────────────────────

def list_categories(db: Session, business_id: int) -> list[Category]:
    return (
        db.query(Category)
        .filter(Category.business_id == business_id)
        .order_by(Category.name)
        .all()
    )

def create_category(db: Session, business_id: int, data: CategoryCreate) -> Category:
    cat = Category(business_id=business_id, **data.model_dump())
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat

def update_category(db: Session, cat_id: int, business_id: int, data: CategoryUpdate) -> Category:
    cat = db.query(Category).filter(Category.id == cat_id, Category.business_id == business_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(cat, k, v)
    db.commit()
    db.refresh(cat)
    return cat

def delete_category(db: Session, cat_id: int, business_id: int) -> None:
    cat = db.query(Category).filter(Category.id == cat_id, Category.business_id == business_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    # Soft delete
    cat.is_active = False
    db.commit()


# ─── Brand ───────────────────────────────────────────────────────────────────

def list_brands(db: Session, business_id: int) -> list[Brand]:
    return (
        db.query(Brand)
        .filter(Brand.business_id == business_id)
        .order_by(Brand.name)
        .all()
    )

def create_brand(db: Session, business_id: int, data: BrandCreate) -> Brand:
    brand = Brand(business_id=business_id, **data.model_dump())
    db.add(brand)
    db.commit()
    db.refresh(brand)
    return brand

def update_brand(db: Session, brand_id: int, business_id: int, data: BrandUpdate) -> Brand:
    brand = db.query(Brand).filter(Brand.id == brand_id, Brand.business_id == business_id).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(brand, k, v)
    db.commit()
    db.refresh(brand)
    return brand

def delete_brand(db: Session, brand_id: int, business_id: int) -> None:
    brand = db.query(Brand).filter(Brand.id == brand_id, Brand.business_id == business_id).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Brand not found")
    brand.is_active = False
    db.commit()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _build_product_response(product: Product) -> ProductResponse:
    """Convert ORM Product → ProductResponse, attaching computed fields."""
    variants_out = []
    for v in product.variants:
        in_stock = 0
        if product.is_serialized:
            try:
                in_stock = v.serials.filter_by(status="IN_STOCK").count()
            except Exception:
                in_stock = 0

        stock_val = v.current_stock
        vr = VariantResponse(
            id=v.id,
            product_id=v.product_id,
            name=v.name,
            sku=v.sku,
            barcode=v.barcode,
            cost_price=v.cost_price,
            selling_price=v.selling_price,
            warranty_months=v.warranty_months,
            reorder_level=v.reorder_level,
            current_stock=stock_val,
            other_specs=v.other_specs,
            is_active=v.is_active,
            created_at=v.created_at,
            in_stock_serials=in_stock,
        )
        variants_out.append(vr)

    return ProductResponse(
        id=product.id,
        business_id=product.business_id,
        name=product.name,
        description=product.description,
        brand_id=product.brand_id,
        category_id=product.category_id,
        is_serialized=product.is_serialized,
        is_active=product.is_active,
        created_at=product.created_at,
        total_stock=product.total_stock,
        brand_name=product.brand.name if product.brand else None,
        category_name=product.category.name if product.category else None,
        variants=variants_out,
    )


# ─── Product ─────────────────────────────────────────────────────────────────

def list_products(
    db: Session,
    business_id: int,
    search: str | None = None,
    category_id: int | None = None,
    brand_id: int | None = None,
    is_active: bool | None = True,
    page: int = 1,
    per_page: int = 20,
):
    query = (
        db.query(Product)
        .filter(Product.business_id == business_id)
    )
    if is_active is not None:
        query = query.filter(Product.is_active == is_active)
    if category_id:
        query = query.filter(Product.category_id == category_id)
    if brand_id:
        query = query.filter(Product.brand_id == brand_id)
    if search:
        query = query.outerjoin(Product.brand).filter(
            or_(
                Product.name.ilike(f"%{search}%"),
                Brand.name.ilike(f"%{search}%"),
            )
        )

    total = query.count()
    products = (
        query.order_by(Product.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    items = []
    for p in products:
        items.append(ProductListResponse(
            id=p.id,
            name=p.name,
            is_serialized=p.is_serialized,
            is_active=p.is_active,
            brand_name=p.brand.name if p.brand else None,
            category_name=p.category.name if p.category else None,
            total_stock=p.total_stock,
            variant_count=len(p.variants),
            created_at=p.created_at,
            variants=[
                VariantResponse(
                    id=v.id,
                    product_id=v.product_id,
                    name=v.name,
                    sku=v.sku,
                    barcode=v.barcode,
                    cost_price=v.cost_price,
                    selling_price=v.selling_price,
                    warranty_months=v.warranty_months or 0,
                    reorder_level=v.reorder_level or 0,
                    current_stock=v.current_stock,
                    other_specs=v.other_specs,
                    is_active=v.is_active,
                    created_at=v.created_at,
                    in_stock_serials=v.in_stock_count if p.is_serialized else 0,
                )
                for v in p.variants if v.is_active
            ],
        ))

    import math
    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total else 0,
    }


def get_product(db: Session, product_id: int, business_id: int) -> Product:
    product = db.query(Product).filter(
        Product.id == product_id,
        Product.business_id == business_id,
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


def create_product(
    db: Session,
    business_id: int,
    user_id: int,
    data: ProductCreate,
) -> Product:
    # Validate brand + category belong to this business
    if data.brand_id:
        brand = db.query(Brand).filter(Brand.id == data.brand_id, Brand.business_id == business_id).first()
        if not brand:
            raise HTTPException(status_code=404, detail="Brand not found")
    if data.category_id:
        cat = db.query(Category).filter(Category.id == data.category_id, Category.business_id == business_id).first()
        if not cat:
            raise HTTPException(status_code=404, detail="Category not found")

    # Check for duplicate SKUs in incoming variants
    skus = [v.sku for v in data.variants if v.sku]
    if len(skus) != len(set(skus)):
        raise HTTPException(status_code=409, detail="Duplicate SKU in variants")
    for sku in skus:
        existing = db.query(ProductVariant).filter(ProductVariant.sku == sku).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"SKU '{sku}' already exists")

    product = Product(
        business_id=business_id,
        name=data.name,
        description=data.description,
        brand_id=data.brand_id,
        category_id=data.category_id,
        is_serialized=data.is_serialized,
        created_by=user_id,
    )
    db.add(product)
    db.flush()

    now = datetime.now(timezone.utc)
    for vdata in data.variants:
        init_stock = max(0, getattr(vdata, 'initial_stock', 0) or 0)
        variant = ProductVariant(
            product_id=product.id,
            name=vdata.name,
            sku=vdata.sku,
            barcode=vdata.barcode,
            cost_price=vdata.cost_price,
            selling_price=vdata.selling_price,
            warranty_months=vdata.warranty_months,
            reorder_level=vdata.reorder_level,
            current_stock=init_stock,
            other_specs=vdata.other_specs,
        )
        db.add(variant)
        db.flush()

        if init_stock > 0 and product.is_serialized:
            clean_sku = (vdata.sku or "SN").strip().upper()
            for i in range(init_stock):
                sn = SerialNumber(
                    business_id=business_id,
                    variant_id=variant.id,
                    serial=f"{clean_sku}-{now.strftime('%y%m%d')}-{i+1:04d}",
                    status="IN_STOCK",
                    cost_price=vdata.cost_price,
                    received_at=now,
                    notes="Initial stock on product creation",
                )
                db.add(sn)

    db.commit()
    db.refresh(product)
    return product


def update_product(
    db: Session,
    product_id: int,
    business_id: int,
    data: ProductUpdate,
) -> Product:
    product = get_product(db, product_id, business_id)
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(product, k, v)
    db.commit()
    db.refresh(product)
    return product


def delete_product(db: Session, product_id: int, business_id: int) -> None:
    product = get_product(db, product_id, business_id)
    product.is_active = False
    db.commit()


# ─── Variant ─────────────────────────────────────────────────────────────────

def _get_variant(db: Session, variant_id: int, business_id: int) -> ProductVariant:
    v = (
        db.query(ProductVariant)
        .join(Product)
        .filter(ProductVariant.id == variant_id, Product.business_id == business_id)
        .first()
    )
    if not v:
        raise HTTPException(status_code=404, detail="Variant not found")
    return v


def add_variant(
    db: Session,
    product_id: int,
    business_id: int,
    data: VariantCreate,
    user_id: int,
) -> ProductVariant:
    product = get_product(db, product_id, business_id)
    if data.sku:
        existing = db.query(ProductVariant).filter(ProductVariant.sku == data.sku).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"SKU '{data.sku}' already exists")

    variant = ProductVariant(product_id=product.id, **data.model_dump())
    db.add(variant)
    db.commit()
    db.refresh(variant)
    return variant


def update_variant(
    db: Session,
    variant_id: int,
    business_id: int,
    data: VariantUpdate,
    user_id: int,
) -> ProductVariant:
    variant = _get_variant(db, variant_id, business_id)

    # Record price history if prices are changing
    changes = data.model_dump(exclude_none=True)
    price_changed = "cost_price" in changes or "selling_price" in changes
    if price_changed:
        history = PriceHistory(
            variant_id=variant.id,
            old_cost_price=variant.cost_price,
            new_cost_price=changes.get("cost_price", variant.cost_price),
            old_sell_price=variant.selling_price,
            new_sell_price=changes.get("selling_price", variant.selling_price),
            changed_by=user_id,
            changed_at=datetime.now(timezone.utc).isoformat(),
        )
        db.add(history)

    if data.sku and data.sku != variant.sku:
        existing = db.query(ProductVariant).filter(ProductVariant.sku == data.sku).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"SKU '{data.sku}' already exists")

    # Handle current_stock edit if specified
    if "current_stock" in changes:
        new_stock = max(0, int(changes.pop("current_stock")))
        diff = new_stock - variant.current_stock
        if diff != 0:
            adj = InventoryAdjustment(
                business_id=business_id,
                variant_id=variant.id,
                adjustment_type=AdjustmentType.CORRECTION,
                quantity_change=diff,
                reason="Stock edited directly in product edit",
                adjusted_by=user_id,
            )
            db.add(adj)

            if variant.product and variant.product.is_serialized:
                if diff > 0:
                    sku_clean = (variant.sku or f"VAR{variant.id}").replace(" ", "").upper()
                    date_str = datetime.now(timezone.utc).strftime("%y%m%d")
                    existing_count = db.query(SerialNumber).filter_by(variant_id=variant.id).count()
                    for i in range(1, diff + 1):
                        sn = SerialNumber(
                            business_id=business_id,
                            variant_id=variant.id,
                            serial=f"{sku_clean}-{date_str}-{existing_count + i:04d}",
                            status="IN_STOCK",
                            cost_price=variant.cost_price,
                        )
                        db.add(sn)
                elif diff < 0:
                    serials_to_update = (
                        db.query(SerialNumber)
                        .filter_by(variant_id=variant.id, status="IN_STOCK")
                        .limit(abs(diff))
                        .all()
                    )
                    for sn in serials_to_update:
                        sn.status = "ADJUSTED"

            variant.current_stock = new_stock

    for k, v in changes.items():
        setattr(variant, k, v)

    db.commit()
    db.refresh(variant)
    return variant


def get_variant_price_history(db: Session, variant_id: int, business_id: int) -> list[PriceHistory]:
    variant = _get_variant(db, variant_id, business_id)
    return (
        db.query(PriceHistory)
        .filter(PriceHistory.variant_id == variant.id)
        .order_by(PriceHistory.changed_at.desc())
        .all()
    )


# ─── Barcode / SKU scan lookup ────────────────────────────────────────────────

def lookup_by_scan(
    db: Session,
    business_id: int,
    barcode: str | None = None,
    sku: str | None = None,
) -> dict:
    """
    Look up a product variant by barcode or SKU.

    Used by the barcode scanner page (Phase 6).
    Returns the variant with its parent product details and current stock.

    Raises 404 if not found.
    """
    if not barcode and not sku:
        raise HTTPException(status_code=422, detail="Provide barcode or sku")

    query = (
        db.query(ProductVariant)
        .join(Product)
        .filter(Product.business_id == business_id, ProductVariant.is_active == True)
    )

    if barcode and sku:
        query = query.filter(
            or_(ProductVariant.barcode == barcode, ProductVariant.sku == sku)
        )
    elif barcode:
        query = query.filter(ProductVariant.barcode == barcode)
    else:
        query = query.filter(ProductVariant.sku == sku)

    variant: ProductVariant | None = query.first()
    if not variant:
        raise HTTPException(
            status_code=404,
            detail=f"No product found for {'barcode=' + barcode if barcode else 'sku=' + sku}",
        )

    product = variant.product
    in_stock_serials = variant.serials.filter_by(status="IN_STOCK").count() if product.is_serialized else None

    return {
        "variant_id":       variant.id,
        "variant_name":     variant.name,
        "sku":              variant.sku,
        "barcode":          variant.barcode,
        "product_id":       product.id,
        "product_name":     product.name,
        "is_serialized":    product.is_serialized,
        "brand_name":       product.brand.name if product.brand else None,
        "category_name":    product.category.name if product.category else None,
        "cost_price":       float(variant.cost_price),
        "selling_price":    float(variant.selling_price),
        "current_stock":    variant.current_stock,
        "reorder_level":    variant.reorder_level,
        "in_stock_serials": in_stock_serials,
        "is_low_stock":     variant.current_stock < variant.reorder_level,
        "warranty_months":  variant.warranty_months,
    }
