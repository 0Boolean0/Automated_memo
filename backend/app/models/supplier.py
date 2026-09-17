"""
Supplier & SupplierContact models.

A Supplier is a company or individual you buy products from.
SupplierContact are the people at that company you communicate with.
"""

from sqlalchemy import Column, Integer, String, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin


class Supplier(TimestampMixin, Base):
    __tablename__ = "suppliers"

    id          = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    name        = Column(String(255), nullable=False, index=True)
    company     = Column(String(255), nullable=True)
    phone       = Column(String(50),  nullable=True)
    email       = Column(String(255), nullable=True)
    address     = Column(Text,        nullable=True)
    notes       = Column(Text,        nullable=True)
    is_active   = Column(Boolean,     default=True, nullable=False)

    contacts  = relationship("SupplierContact", back_populates="supplier", cascade="all, delete-orphan")
    purchases = relationship("Purchase", back_populates="supplier")

    def __repr__(self):
        return f"<Supplier id={self.id} name='{self.name}'>"


class SupplierContact(Base):
    __tablename__ = "supplier_contacts"

    id          = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, index=True)
    name        = Column(String(255), nullable=False)
    phone       = Column(String(50),  nullable=True)
    email       = Column(String(255), nullable=True)
    role        = Column(String(100), nullable=True)
    is_primary  = Column(Boolean,     default=False, nullable=False)

    supplier = relationship("Supplier", back_populates="contacts")

    def __repr__(self):
        return f"<SupplierContact id={self.id} name='{self.name}'>"
