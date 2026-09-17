"""Main API v1 router."""

from fastapi import APIRouter
from app.api.v1.endpoints import (
    health, auth, users, roles, business,
    categories, products,
    suppliers, purchases, inventory,
    customers, sales,
)

api_router = APIRouter()

api_router.include_router(health.router,     prefix="/health",     tags=["health"])
api_router.include_router(auth.router,       prefix="/auth",       tags=["auth"])
api_router.include_router(users.router,      prefix="/users",      tags=["users"])
api_router.include_router(roles.router,      prefix="/roles",      tags=["roles"])
api_router.include_router(business.router,   prefix="/business",   tags=["business"])
api_router.include_router(categories.router, prefix="",            tags=["catalog"])
api_router.include_router(products.router,   prefix="/products",   tags=["products"])
api_router.include_router(suppliers.router,  prefix="/suppliers",  tags=["suppliers"])
api_router.include_router(purchases.router,  prefix="/purchases",  tags=["purchases"])
api_router.include_router(inventory.router,  prefix="/adjustments", tags=["inventory"])
api_router.include_router(customers.router,  prefix="/customers",   tags=["customers"])
api_router.include_router(sales.router,      prefix="/sales",        tags=["sales"])
