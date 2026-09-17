"""
Customer endpoints — Phase 7.

GET    /customers/           → paginated list with search/type filter
POST   /customers/           → create new customer
GET    /customers/{id}       → full customer detail
PUT    /customers/{id}       → update customer (also used to deactivate: is_active=false)
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.auth.dependencies import require_permission
from app.models.user import User
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerResponse
from app.services import customer_service

router = APIRouter()


@router.get("/", response_model=dict)
def list_customers(
    search:        Optional[str] = Query(None),
    customer_type: Optional[str] = Query(None, description="RETAIL or WHOLESALE"),
    page:          int           = Query(1,  ge=1),
    per_page:      int           = Query(50, ge=1, le=200),
    current_user: User = Depends(require_permission("view_customers")),
    db: Session = Depends(get_db),
):
    """List customers with optional search (name or phone) and type filter."""
    return customer_service.list_customers(
        db, current_user.business_id,
        search=search, customer_type=customer_type,
        page=page, per_page=per_page,
    )


@router.post("/", response_model=CustomerResponse, status_code=201)
def create_customer(
    data: CustomerCreate,
    current_user: User = Depends(require_permission("manage_customers")),
    db: Session = Depends(get_db),
):
    """Create a new customer."""
    customer = customer_service.create_customer(db, current_user.business_id, data)
    return customer_service.build_customer_response(customer)


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: int,
    current_user: User = Depends(require_permission("view_customers")),
    db: Session = Depends(get_db),
):
    """Get full customer detail."""
    customer = customer_service.get_customer(db, customer_id, current_user.business_id)
    return customer_service.build_customer_response(customer)


@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: int,
    data: CustomerUpdate,
    current_user: User = Depends(require_permission("manage_customers")),
    db: Session = Depends(get_db),
):
    """
    Update customer fields.
    To deactivate a customer, send: {"is_active": false}
    """
    customer = customer_service.update_customer(
        db, customer_id, current_user.business_id, data
    )
    return customer_service.build_customer_response(customer)
