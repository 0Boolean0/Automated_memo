"""
Role management endpoints (Admin only).

GET  /roles        → list all roles for this business
POST /roles        → create a custom role
PUT  /roles/{id}   → update role permissions
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.auth.dependencies import require_any_role
from app.models.user import User, Role
from app.schemas.auth import RoleCreate, RoleUpdate, RoleResponse

router = APIRouter()


@router.get("/", response_model=list[RoleResponse])
def list_roles(
    current_user: User = Depends(require_any_role("ADMIN", "MANAGER")),
    db: Session = Depends(get_db),
):
    roles = (
        db.query(Role)
        .filter(Role.business_id == current_user.business_id)
        .order_by(Role.name)
        .all()
    )
    return roles


@router.post("/", response_model=RoleResponse, status_code=201)
def create_role(
    data: RoleCreate,
    current_user: User = Depends(require_any_role("ADMIN")),
    db: Session = Depends(get_db),
):
    existing = db.query(Role).filter(
        Role.business_id == current_user.business_id,
        Role.name == data.name.upper(),
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Role '{data.name}' already exists")

    role = Role(
        business_id=current_user.business_id,
        name=data.name.upper(),
        permissions=data.permissions,
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


@router.put("/{role_id}", response_model=RoleResponse)
def update_role_permissions(
    role_id: int,
    data: RoleUpdate,
    current_user: User = Depends(require_any_role("ADMIN")),
    db: Session = Depends(get_db),
):
    role = db.query(Role).filter(
        Role.id == role_id,
        Role.business_id == current_user.business_id,
    ).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    role.permissions = data.permissions
    db.commit()
    db.refresh(role)
    return role
