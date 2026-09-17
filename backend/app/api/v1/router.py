"""
Main API v1 router.
Collects all feature routers and mounts them under /api/v1.
"""

from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, users, roles, business

api_router = APIRouter()

# Health — always public
api_router.include_router(health.router,    prefix="/health",   tags=["health"])

# Auth — login/logout/me
api_router.include_router(auth.router,      prefix="/auth",     tags=["auth"])

# User management (Admin/Manager)
api_router.include_router(users.router,     prefix="/users",    tags=["users"])

# Role management (Admin)
api_router.include_router(roles.router,     prefix="/roles",    tags=["roles"])

# Business settings
api_router.include_router(business.router,  prefix="/business", tags=["business"])

# ── Future routes (added in later phases) ─────────────────────────────────────
# Phase 3:  products, variants, brands, categories
# Phase 4:  suppliers, purchases
# Phase 5:  inventory, serials
# Phase 6:  scan
# Phase 7:  customers
# Phase 8:  sales, pos
# Phase 9:  invoices
# Phase 10: warranties
# Phase 11: returns, damaged
# Phase 12: reports
# Phase 13: backup
