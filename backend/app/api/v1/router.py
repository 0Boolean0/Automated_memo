"""
Main API v1 router.
"""

from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, users, roles, business, categories, products

api_router = APIRouter()

# Public / infra
api_router.include_router(health.router,      prefix="/health",     tags=["health"])

# Auth
api_router.include_router(auth.router,        prefix="/auth",       tags=["auth"])

# Users & Roles
api_router.include_router(users.router,       prefix="/users",      tags=["users"])
api_router.include_router(roles.router,       prefix="/roles",      tags=["roles"])

# Business settings
api_router.include_router(business.router,    prefix="/business",   tags=["business"])

# Product catalog
api_router.include_router(categories.router,  prefix="",            tags=["catalog"])
api_router.include_router(products.router,    prefix="/products",   tags=["products"])

# Future phases
# Phase 4:  suppliers, purchases
# Phase 5:  inventory
# Phase 6:  scan
# Phase 7:  customers
# Phase 8:  sales
# Phase 9:  invoices
# Phase 10: warranties
# Phase 11: returns
# Phase 12: reports
# Phase 13: backup
