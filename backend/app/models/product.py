"""
Product-related SQLAlchemy models.

HIERARCHY:
    Business
      ├── Category (e.g. "Keyboards", "Headphones")
      │     └── sub-categories (self-referential)
      ├── Brand (e.g. "AJAZZ", "Eweadn")
      └── Product (e.g. "AJAZZ AK820")
            └── ProductVariant (e.g. "Wireless / Blue Switch")
                  └── SerialNumber (individual unit, Phase 4/5)

KEY DESIGN DECISIONS:
- Product.is_serialized = True  → track individual serial numbers
- Product.is_serialized = False → track quantity only (non-serialized)
- current_stock on ProductVariant is the live count (updated on every transaction)
- cost_price / selling_price on ProductVariant are the CURRENT prices
  Old invoice prices are frozen in sale_items (separate column) — never changed
"""

from sqlalchemy import (
    Column, Integer, String, Boolean, Text,
    Numeric, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin


class Category(TimestampMixin, Base):
    __tablename__ = "categories"

    id          = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    name        = Column(String(255), nullable=False)
    parent_id   = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    description = Column(Text, nullable=True)
    is_active   = Column(Boolean, default=True, nullable=False)

    # Self-referential: a category can have child categories
    children = relationship("Category", backref="parent", remote_side="Category.id")
    products = relationship("Product", back_populates="category")

    def __repr__(self):
        return f"<Category id={self.id} name='{self.name}'>"


class Brand(TimestampMixin, Base):
    __tablename__ = "brands"

    id          = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    name        = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active   = Column(Boolean, default=True, nullable=False)

    products = relationship("Product", back_populates="brand")

    def __repr__(self):
        return f"<Brand id={self.id} name='{self.name}'>"


class Product(TimestampMixin, Base):
    __tablename__ = "products"

    id            = Column(Integer, primary_key=True, index=True)
    business_id   = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    brand_id      = Column(Integer, ForeignKey("brands.id", ondelete="SET NULL"), nullable=True, index=True)
    category_id   = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    name          = Column(String(255), nullable=False, index=True)
    description   = Column(Text, nullable=True)

    # is_serialized=True  → every unit has its own serial number tracked in serial_numbers table
    # is_serialized=False → only quantity is tracked (bulk items, accessories, etc.)
    is_serialized = Column(Boolean, default=True, nullable=False)
    is_active     = Column(Boolean, default=True, nullable=False)
    created_by    = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    brand    = relationship("Brand",    back_populates="products")
    category = relationship("Category", back_populates="products")
    variants = relationship(
        "ProductVariant",
        back_populates="product",
        cascade="all, delete-orphan",
        lazy="select",
    )

    @property
    def total_stock(self) -> int:
        """Sum of current_stock across all active variants."""
        total = 0
        for v in self.variants:
            if not v.is_active:
                continue
            if self.is_serialized:
                total += max(v.current_stock, v.in_stock_count)
            else:
                total += v.current_stock
        return total

    def __repr__(self):
        return f"<Product id={self.id} name='{self.name}'>"


class ProductVariant(TimestampMixin, Base):
    """
    A specific version of a product.

    Examples:
        Product:  AJAZZ AK820
        Variants: AK820 Wired / Red Switch
                  AK820 Wireless / Blue Switch
                  AK820 Wireless / Brown Switch

    Each variant has its own:
        - SKU (unique stock-keeping unit code)
        - Barcode
        - Cost price (what you paid)
        - Selling price (what you charge)
        - Warranty period
        - Reorder level (get alerted when stock falls below this)
        - current_stock (updated automatically on every transaction)
    """
    __tablename__ = "product_variants"

    id              = Column(Integer, primary_key=True, index=True)
    product_id      = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    name            = Column(String(255), nullable=False)       # e.g. "Wireless / Blue Switch"
    sku             = Column(String(100), unique=True, nullable=True, index=True)
    barcode         = Column(String(200), nullable=True, index=True)

    # Prices (current). Frozen copies are stored in sale_items at time of sale.
    cost_price      = Column(Numeric(12, 2), nullable=False, default=0)
    selling_price   = Column(Numeric(12, 2), nullable=False, default=0)

    warranty_months = Column(Integer, default=0, nullable=False)  # 0 = no warranty
    reorder_level   = Column(Integer, default=5, nullable=False)

    # current_stock is maintained by the inventory service:
    #   +N when stock is received (purchase)
    #   -1 when sold (sale)
    #   adjusted manually (inventory adjustment)
    # For serialized products this always equals the count of IN_STOCK serials.
    current_stock   = Column(Integer, default=0, nullable=False)

    # Extra specs stored as a JSON dict (flexible, no migrations needed)
    # e.g. {"color": "Black", "switch": "Blue", "connectivity": "Wireless"}
    other_specs     = Column(JSON, nullable=True)

    is_active       = Column(Boolean, default=True, nullable=False)

    product      = relationship("Product", back_populates="variants")
    serials      = relationship("SerialNumber", back_populates="variant", lazy="dynamic")
    price_history = relationship("PriceHistory", back_populates="variant", lazy="select")

    @property
    def in_stock_count(self) -> int:
        """Count of serials with status IN_STOCK (only for serialized products)."""
        return self.serials.filter_by(status="IN_STOCK").count()  # type: ignore[attr-defined]

    def __repr__(self):
        return f"<ProductVariant id={self.id} sku='{self.sku}'>"


class PriceHistory(Base):
    """
    Immutable record of every price change on a variant.
    Used for auditing and understanding profit trends over time.
    Never delete rows from this table.
    """
    __tablename__ = "price_history"

    id              = Column(Integer, primary_key=True, index=True)
    variant_id      = Column(Integer, ForeignKey("product_variants.id", ondelete="CASCADE"), nullable=False, index=True)
    old_cost_price  = Column(Numeric(12, 2), nullable=True)
    new_cost_price  = Column(Numeric(12, 2), nullable=True)
    old_sell_price  = Column(Numeric(12, 2), nullable=True)
    new_sell_price  = Column(Numeric(12, 2), nullable=True)
    changed_by      = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reason          = Column(String(500), nullable=True)
    changed_at      = Column(String(50), nullable=False)   # ISO datetime string

    variant = relationship("ProductVariant", back_populates="price_history")
