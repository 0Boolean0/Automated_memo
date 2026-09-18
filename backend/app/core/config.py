"""
Application configuration.

Settings are loaded from environment variables or a .env file.
pydantic-settings automatically reads the .env file if it exists.

Usage:
    from app.core.config import settings
    print(settings.DATABASE_URL)
"""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from pathlib import Path
import os

# Resolve the project root (two levels up from this file: app/core/config.py → app/ → backend/ → project root)
# We go one more level to smartstock/ root so data/ and backups/ sit at the project root.
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent   # .../smartstock/backend
PROJECT_ROOT = BACKEND_DIR.parent                              # .../smartstock


class Settings(BaseSettings):
    # ─────────────────────────────────────────
    # Application
    # ─────────────────────────────────────────
    APP_NAME: str = "SmartStock"
    APP_VERSION: str = "0.1.0"
    APP_DESCRIPTION: str = "Local-first Smart Inventory & POS System"
    DEBUG: bool = True

    # ─────────────────────────────────────────
    # Server
    # ─────────────────────────────────────────
    # HOST = "0.0.0.0" means FastAPI listens on ALL network interfaces,
    # including your local IP (192.168.x.x). This is needed so your phone
    # can reach the server. Change to "127.0.0.1" to restrict to localhost only.
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # ─────────────────────────────────────────
    # Database
    # ─────────────────────────────────────────
    # SQLite file path. The data/ folder sits at the project root, NOT inside
    # the backend source code. This keeps the database separate from code.
    DATABASE_URL: str = f"sqlite:///{PROJECT_ROOT / 'data' / 'inventory.db'}"

    # For future PostgreSQL migration, you would change this to:
    # DATABASE_URL: str = "postgresql://user:password@localhost:5432/smartstock"
    # Nothing else in the application needs to change — SQLAlchemy handles the rest.

    # ─────────────────────────────────────────
    # Authentication (JWT)
    # ─────────────────────────────────────────
    # IMPORTANT: Change this secret key before using in any real environment.
    # Generate a strong key with: python -c "import secrets; print(secrets.token_hex(32))"
    SECRET_KEY: str = "change-this-to-a-long-random-secret-key-before-production"
    ALGORITHM: str = "HS256"

    # How long the access token is valid. Short expiry = more secure.
    # The refresh token (set in cookie) lasts longer and gets a new access token.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8 hours — comfortable for a full work day
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # ─────────────────────────────────────────
    # Paths
    # ─────────────────────────────────────────
    DATA_DIR: Path = PROJECT_ROOT / "data"
    BACKUP_DIR: Path = PROJECT_ROOT / "backups"
    PDF_DIR: Path = PROJECT_ROOT / "pdfs"
    STATIC_DIR: Path = BACKEND_DIR / "static"   # for serving built React files later

    # ─────────────────────────────────────────
    # CORS (Cross-Origin Resource Sharing)
    # ─────────────────────────────────────────
    # These are the origins allowed to make requests to our API.
    # During development the React Vite dev server runs on port 5173.
    # We also allow any local network IP pattern via the middleware logic.
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",    # Vite dev server
        "http://localhost:8000",    # FastAPI (serving built React)
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
    ]

    # ─────────────────────────────────────────
    # Business defaults
    # ─────────────────────────────────────────
    DEFAULT_CURRENCY: str = "BDT"
    DEFAULT_BUSINESS_NAME: str = "GizmoCrave"

    class Config:
        # If a .env file exists next to this project, load it automatically.
        # Create a .env file to override settings without editing source code.
        env_file = str(BACKEND_DIR / ".env")
        env_file_encoding = "utf-8"
        case_sensitive = True


# Single instance used across the entire application.
# Import it like: from app.core.config import settings
settings = Settings()

# Ensure required directories exist when config loads
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.BACKUP_DIR.mkdir(parents=True, exist_ok=True)
settings.PDF_DIR.mkdir(parents=True, exist_ok=True)
