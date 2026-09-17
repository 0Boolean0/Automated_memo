"""
User, Role, and UserRole models.
"""

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin


class Role(TimestampMixin, Base):
    __tablename__ = "roles"

    id          = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    name        = Column(String(50), nullable=False)
    permissions = Column(JSON, nullable=False, default=list)

    user_roles  = relationship("UserRole", back_populates="role")

    def has_permission(self, permission: str) -> bool:
        return permission in (self.permissions or [])

    def __repr__(self):
        return f"<Role id={self.id} name='{self.name}'>"


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    business_id     = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    username        = Column(String(100), unique=True, nullable=False, index=True)
    email           = Column(String(255), unique=True, nullable=True, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name       = Column(String(255), nullable=True)
    phone           = Column(String(50), nullable=True)
    is_active       = Column(Boolean, default=True, nullable=False)
    last_login      = Column(DateTime(timezone=True), nullable=True)

    business   = relationship("Business", back_populates="users")
    user_roles = relationship(
        "UserRole",
        back_populates="user",
        foreign_keys="[UserRole.user_id]",
        cascade="all, delete-orphan",
    )

    @property
    def roles(self):
        return [ur.role for ur in self.user_roles if ur.role]

    @property
    def permissions(self):
        perms = set()
        for role in self.roles:
            perms.update(role.permissions or [])
        return list(perms)

    def has_permission(self, permission: str) -> bool:
        return permission in self.permissions

    def __repr__(self):
        return f"<User id={self.id} username='{self.username}'>"


class UserRole(Base):
    __tablename__ = "user_roles"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role_id        = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_at    = Column(DateTime(timezone=True), nullable=True)
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    user = relationship("User", back_populates="user_roles", foreign_keys=[user_id])
    role = relationship("Role", back_populates="user_roles")

    def __repr__(self):
        return f"<UserRole user_id={self.user_id} role_id={self.role_id}>"
