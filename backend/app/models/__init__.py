"""
Import all models here so Alembic detects them for migrations.
Add every new model file import here when created.
"""

from app.models.business import Business
from app.models.user import User, Role, UserRole
from app.models.product import Category, Brand, Product, ProductVariant, PriceHistory
from app.models.serial import SerialNumber
