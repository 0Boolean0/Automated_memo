"""
SmartStock — Main FastAPI Application Entry Point.

Run with:
    uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
from pathlib import Path

from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.api.v1.router import api_router

import app.models  # noqa: F401 — registers all models with Base.metadata

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Lifespan
# ─────────────────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Database: {settings.DATABASE_URL}")

    # Create any tables not yet in the DB (safe, idempotent)
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables verified.")

    # Seed defaults on first run (creates admin user + roles if DB is empty)
    from app.utils.seeder import seed_database
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()

    yield

    logger.info(f"{settings.APP_NAME} shutting down.")


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI app
# ─────────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    description=settings.APP_DESCRIPTION,
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# ─────────────────────────────────────────────────────────────────────────────
# CORS
# ─────────────────────────────────────────────────────────────────────────────
if settings.DEBUG:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )

# ─────────────────────────────────────────────────────────────────────────────
# Static files (logos, built React app in production)
# ─────────────────────────────────────────────────────────────────────────────
settings.STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(settings.STATIC_DIR)), name="static")

# ─────────────────────────────────────────────────────────────────────────────
# API routes
# ─────────────────────────────────────────────────────────────────────────────
app.include_router(api_router, prefix="/api/v1")


# ─────────────────────────────────────────────────────────────────────────────
# Root
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/", tags=["root"])
def root():
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
