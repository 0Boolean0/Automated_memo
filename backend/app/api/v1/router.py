"""
Main API v1 router.

This file collects all endpoint routers and mounts them under /api/v1.
As we build each feature (auth, products, sales...), we import its router here.

Think of this as the "table of contents" for the entire API.
"""

from fastapi import APIRouter
from app.api.v1.endpoints import health

# The main v1 router. All feature routers are included here.
api_router = APIRouter()

# Health check — always available, no authentication required
api_router.include_router(
    health.router,
    prefix="/health",
    tags=["health"],
)

# Future routers will be added here as we build each phase:
# from app.api.v1.endpoints import auth, products, sales, ...
# api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
# api_router.include_router(products.router, prefix="/products", tags=["products"])
