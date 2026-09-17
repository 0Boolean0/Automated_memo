"""
Shared column mixins used by multiple models.

A mixin is a simple Python class (not a SQLAlchemy model itself) that adds
reusable columns to any model that inherits from it.

Example:
    class Product(TimestampMixin, Base):
        __tablename__ = "products"
        # Product automatically gets created_at and updated_at columns
"""

from sqlalchemy import Column, Integer, DateTime
from sqlalchemy.sql import func
from datetime import datetime, timezone


class TimestampMixin:
    """Adds created_at and updated_at columns to any model."""

    # func.now() uses the database's current timestamp function.
    # server_default means the database sets this value — not Python.
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # onupdate=func.now() automatically updates this column whenever
    # the row is modified via SQLAlchemy. You don't need to set it manually.
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SoftDeleteMixin:
    """
    Adds is_active flag to any model.
    Instead of deleting rows (which breaks audit history and foreign keys),
    we set is_active = False to 'soft delete' a record.
    """
    from sqlalchemy import Boolean
    is_active = Column(Boolean, default=True, nullable=False)
