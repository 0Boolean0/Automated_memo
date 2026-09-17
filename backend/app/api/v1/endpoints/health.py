"""
Health check endpoints.

These endpoints verify the system is running correctly.
They are public (no authentication required) and are useful for:
- Confirming the server started correctly
- Checking the database connection works
- Getting basic application info
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.config import settings

router = APIRouter()


@router.get("/")
def health_check():
    """
    Basic health check.
    Returns 200 OK if the FastAPI server is running.
    """
    return {
        "status": "ok",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/db")
def database_health(db: Session = Depends(get_db)):
    """
    Database connectivity check.
    Runs a simple query to confirm SQLAlchemy can talk to the SQLite file.
    Returns 503 if the database is unreachable.
    """
    try:
        # text() wraps a raw SQL string safely for SQLAlchemy
        result = db.execute(text("SELECT 1")).scalar()
        return {
            "status": "ok",
            "database": "connected",
            "db_file": settings.DATABASE_URL,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Database unavailable: {str(e)}"
        )


@router.get("/info")
def app_info():
    """
    Application info endpoint.
    Returns configuration details useful for debugging.
    Does NOT expose sensitive values like SECRET_KEY.
    """
    return {
        "app_name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "description": settings.APP_DESCRIPTION,
        "debug": settings.DEBUG,
        "currency": settings.DEFAULT_CURRENCY,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
