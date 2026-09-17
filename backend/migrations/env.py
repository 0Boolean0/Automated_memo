"""
Alembic migration environment.

This file tells Alembic:
1. Which database to connect to (from our settings)
2. Which models to scan for changes (Base.metadata)

Alembic uses this file every time you run:
    alembic revision --autogenerate -m "description"
    alembic upgrade head
"""

from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import sys
import os

# ── Add backend/ to Python path so we can import our app modules ──────────────
# Alembic runs from the backend/ directory, so we need to make sure Python
# can find our app package.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import our models and config
from app.core.config import settings
from app.core.database import Base

# Import ALL models here so Alembic sees them in Base.metadata.
# If you add a new model and don't import it here, Alembic won't detect it.
import app.models  # noqa: F401

# ── Alembic config object ──────────────────────────────────────────────────────
config = context.config

# Set up Python logging from alembic.ini
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# !! Override the database URL with our real URL from settings !!
# This is how we connect Alembic to the same database as the application.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# This is the metadata object that Alembic inspects to detect model changes.
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.
    This generates SQL scripts without connecting to the database.
    Useful for reviewing what SQL will be executed.
    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # render_as_batch=True is REQUIRED for SQLite to support ALTER TABLE.
        # SQLite doesn't support ALTER COLUMN natively; Alembic uses batch mode
        # to recreate the table instead.
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    Run migrations in 'online' mode (default).
    This connects to the database and applies migrations directly.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # IMPORTANT for SQLite: enables batch mode for ALTER TABLE support
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
