"""
User management endpoints (Admin only).

GET    /users           → list all users
POST   /users           → create a new user
GET    /users/{id}      → get a specific user
PUT    /users/{id}      → update user
DELETE /users/{id}      → deactivate user (soft delete)
PUT    /users/{id}/role → change user's role
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.auth.dependencies import get_current_user, require_any_role
from app.models.user import User, Role
from app.schemas.auth import UserCreate, UserUpdate, UserResponse
from app.services import auth_service

router = APIRouter()


@router.get("/", response_model=list[UserResponse])
def list_users(
    current_user: User = Depends(require_any_role("ADMIN", "MANAGER")),
    db: Session = Depends(get_db),
):
    """List all users in the same business."""
    users = (
        db.query(User)
        .filter(User.business_id == current_user.business_id)
        .order_by(User.created_at.desc())
        .all()
    )
    return users


@router.post("/", response_model=UserResponse, status_code=201)
def create_user(
    data: UserCreate,
    current_user: User = Depends(require_any_role("ADMIN")),
    db: Session = Depends(get_db),
):
    """
    Create a new user. Admin only.
    The new user is assigned the role specified in data.role_name.
    """
    user = auth_service.create_user(
        db,
        username=data.username,
        password=data.password,
        business_id=current_user.business_id,
        role_name=data.role_name,
        full_name=data.full_name,
        email=data.email,
        phone=data.phone,
    )
    return user


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(require_any_role("ADMIN", "MANAGER")),
    db: Session = Depends(get_db),
):
    user = auth_service.get_user_by_id(db, user_id)
    # Prevent accessing users from other businesses
    if user.business_id != current_user.business_id:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: UserUpdate,
    current_user: User = Depends(require_any_role("ADMIN")),
    db: Session = Depends(get_db),
):
    """Update user profile and optionally change their role. Admin only."""
    user = auth_service.get_user_by_id(db, user_id)
    if user.business_id != current_user.business_id:
        raise HTTPException(status_code=404, detail="User not found")

    # Handle role change separately
    if data.role_name:
        role = db.query(Role).filter(
            Role.business_id == current_user.business_id,
            Role.name == data.role_name.upper(),
        ).first()
        if not role:
            raise HTTPException(status_code=404, detail=f"Role '{data.role_name}' not found")
        auth_service.assign_role(db, user, role)

    updated = auth_service.update_user(
        db, user,
        full_name=data.full_name,
        email=data.email,
        phone=data.phone,
        is_active=data.is_active,
    )
    return updated


@router.delete("/{user_id}", response_model=UserResponse)
def deactivate_user(
    user_id: int,
    current_user: User = Depends(require_any_role("ADMIN")),
    db: Session = Depends(get_db),
):
    """
    Deactivate a user (soft delete — sets is_active=False).
    The user can be reactivated later. Data is preserved.
    """
    user = auth_service.get_user_by_id(db, user_id)
    if user.business_id != current_user.business_id:
        raise HTTPException(status_code=404, detail="User not found")
    return auth_service.deactivate_user(db, user, requesting_user=current_user)
