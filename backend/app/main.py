"""
SmartStock — Main FastAPI Application Entry Point.

This is where FastAPI is created and configured.
Everything flows from this file:
  - CORS middleware (allows phone browser to call the API)
  - All API routes are mounted here
  - Static files (built React app) will be served from here in production
  - Startup events (database initialization)

Run this file with:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.core.database import engine, Base
from app.api.v1.router import api_router

# Import all models so SQLAlchemy knows about them when creating tables.
# Even though we use Alembic for migrations, this import ensures models
# are registered in Base.metadata.
import app.models  # noqa: F401

# ─────────────────────────────────────────────────────────────────────────────
# Logging setup
# ─────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Lifespan: runs on startup and shutdown
# ─────────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Code before 'yield' runs at application startup.
    Code after 'yield' runs at application shutdown.

    On startup we:
    1. Create all database tables that don't exist yet.
       (In production, Alembic migrations handle this instead.)
    2. Log a startup message.
    """
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Database: {settings.DATABASE_URL}")

    # Create tables for any models not yet in the database.
    # Safe to call multiple times — it won't recreate existing tables.
    # NOTE: For Phase 2+ always use Alembic migrations (alembic upgrade head)
    # instead of relying on this for schema changes.
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified/created.")

    yield  # Application runs here

    logger.info(f"{settings.APP_NAME} shutting down.")


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI Application
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    description=settings.APP_DESCRIPTION,
    version=settings.APP_VERSION,
    # Swagger UI available at http://localhost:8000/docs
    # ReDoc available at http://localhost:8000/redoc
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)


# ─────────────────────────────────────────────────────────────────────────────
# CORS Middleware
# ─────────────────────────────────────────────────────────────────────────────
# CORS (Cross-Origin Resource Sharing) controls which domains/IPs are allowed
# to make requests to our API from a browser.
#
# Problem: The React app runs on localhost:5173 during development.
# The FastAPI runs on localhost:8000.
# Browsers block cross-origin requests unless the server explicitly allows them.
#
# In development we allow all origins (*) to make local testing easy.
# IMPORTANT: In production, restrict this to your actual domain only.

if settings.DEBUG:
    # Development: allow all origins (easy local testing from phone)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # Production: only allow listed origins
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )


# ─────────────────────────────────────────────────────────────────────────────
# API Routes
# ─────────────────────────────────────────────────────────────────────────────
# All API endpoints are prefixed with /api/v1
# This versioning means future breaking changes can be introduced at /api/v2
# without breaking existing clients.
app.include_router(api_router, prefix="/api/v1")


# ─────────────────────────────────────────────────────────────────────────────
# Root endpoint
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/", tags=["root"])
def root():
    """
    Root endpoint. In production this will serve the React app.
    During development, the React Vite dev server handles the frontend.
    """
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "health": "/api/v1/health",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Global error handlers
# ─────────────────────────────────────────────────────────────────────────────
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={"error": "Not found", "path": str(request.url.path)},
    )


@app.exception_handler(500)
async def server_error_handler(request, exc):
    logger.error(f"Server error on {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error. Check server logs."},
    )
