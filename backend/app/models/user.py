"""
User, Role, and UserRole models.

These three tables together handle authentication and authorization:
- User:     A person who logs into the system.
- Role:     A named set of permissions (ADMIN, MANAGER, SELLER, etc.).
- UserRole: The join table connecting Users to Roles (many-to-many).

Why not store the role directly on the User? 
Because a user could theoretically hold multiple roles, and roles can be
customized per business. This structure is more flexible.
"""

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON
)
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.base import TimestampMixin


# ─────────────────────────────────────────────────────────────────────────────
# Role
# ─────────────────────────────────────────────────────────────────────────────

class Role(TimestampMixin, Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)

    # Role name must be one of: ADMIN, MANAGER, STAFF, SELLER, VIEWER
    name = Column(String(50), nullable=False)

    # permissions is a JSON list of strings.
    # Example: ["view_products", "create_sale", "view_reports"]
    # This makes it easy to check: "create_sale" in role.permissions
    permissions = Column(JSON, nullable=False, default=list)

    # ─── Relationships ────────────────────────────────────────────────────────
    user_roles = relationship("UserRole", back_populates="role")

    def has_permission(self, permission: str) -> bool:
        """Check if this role grants a specific permission."""
        return permission in (self.permissions or [])

    def __repr__(self):
        return f"<Role id={self.id} name='{self.name}'>"


# ─────────────────────────────────────────────────────────────────────────────
# User
# ─────────────────────────────────────────────────────────────────────────────

class User(TimestampMixin, Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    business_id = Column(Integer, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)

    # Login credentials
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=True, index=True)

    # NEVER store plain text passwords. This field stores the bcrypt hash.
    # passlib will handle hashing and verification in the auth module.
    hashed_password = Column(String(255), nullable=False)

    # Profile
    full_name = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)

    # Account state
    is_active = Column(Boolean, default=True, nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)

    # ─── Relationships ────────────────────────────────────────────────────────
    business = relationship("Business", back_populates="users")
    user_roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")

    @property
    def roles(self):
        """Convenience property to get Role objects directly."""
        return [ur.role for ur in self.user_roles if ur.role]

    @property
    def permissions(self):
        """Flat list of all permissions from all assigned roles."""
        perms = set()
        for role in self.roles:
            perms.update(role.permissions or [])
        return list(perms)

    def has_permission(self, permission: str) -> bool:
        return permission in self.permissions

    def __repr__(self):
        return f"<User id={self.id} username='{self.username}'>"


# ─────────────────────────────────────────────────────────────────────────────
# UserRole (join table)
# ─────────────────────────────────────────────────────────────────────────────

class UserRole(Base):
    """
    Associates a User with a Role.
    Tracks who assigned the role and when.
    """
    __tablename__ = "user_roles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False, index=True)

    assigned_at = Column(DateTime(timezone=True), nullable=True)
    assigned_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    # assigned_by_id can be NULL for the initial admin setup (no one assigned it)

    # ─── Relationships ────────────────────────────────────────────────────────
    user = relationship("User", back_populates="user_roles", foreign_keys=[user_id])
    role = relationship("Role", back_populates="user_roles")

    def __repr__(self):
        return f"<UserRole user_id={self.user_id} role_id={self.role_id}>"
