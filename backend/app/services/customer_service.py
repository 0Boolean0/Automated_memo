"""Customer service — Phase 7.

CRUD for customers: list with search/pagination, get, create, update.
sale_count is always 0 until Phase 8 (Sales) adds the Sale model.
"""

import math
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.customer import Customer
from app.schemas.customer import (
    CustomerCreate, CustomerUpdate,
    CustomerResponse, CustomerListResponse,
)


def list_customers(
    db: Session,
    business_id: int,
    search: str | None = None,
    customer_type: str | None = None,
    page: int = 1,
    per_page: int = 50,
) -> dict:
    q = (
        db.query(Customer)
        .filter(Customer.business_id == business_id, Customer.is_active == True)
    )
    if search:
        q = q.filter(
            Customer.name.ilike(f"%{search}%") |
            Customer.phone.ilike(f"%{search}%")
        )
    if customer_type:
        q = q.filter(Customer.customer_type == customer_type.upper())

    total = q.count()
    customers = (
        q.order_by(Customer.name)
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    items = [
        CustomerListResponse(
            id=c.id, name=c.name, phone=c.phone, email=c.email,
            customer_type=c.customer_type, loyalty_points=c.loyalty_points,
            is_active=c.is_active, sale_count=0, created_at=c.created_at,
        )
        for c in customers
    ]
    return {
        "items": items,
        "total": total,
        "page": page,
        "per_page": per_page,
        "pages": math.ceil(total / per_page) if total else 0,
    }


def get_customer(db: Session, customer_id: int, business_id: int) -> Customer:
    c = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.business_id == business_id,
    ).first()
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    return c


def create_customer(db: Session, business_id: int, data: CustomerCreate) -> Customer:
    customer = Customer(
        business_id=business_id,
        name=data.name,
        phone=data.phone,
        email=data.email,
        address=data.address,
        customer_type=data.customer_type,
        notes=data.notes,
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customer


def update_customer(
    db: Session,
    customer_id: int,
    business_id: int,
    data: CustomerUpdate,
) -> Customer:
    customer = get_customer(db, customer_id, business_id)
    for key, value in data.model_dump(exclude_none=True).items():
        setattr(customer, key, value)
    db.commit()
    db.refresh(customer)
    return customer


def build_customer_response(customer: Customer) -> CustomerResponse:
    """
    Build the full CustomerResponse.
    sale_count will be wired in Phase 8 once the Sale model exists.
    """
    return CustomerResponse(
        id=customer.id,
        business_id=customer.business_id,
        name=customer.name,
        phone=customer.phone,
        email=customer.email,
        address=customer.address,
        customer_type=customer.customer_type,
        loyalty_points=customer.loyalty_points,
        notes=customer.notes,
        is_active=customer.is_active,
        created_at=customer.created_at,
        sale_count=0,  # Phase 8: replace with real count
    )
