"""
Database engine and session management.

SQLAlchemy Core Concepts:
- Engine:  The connection to the database file. Created once at startup.
- Session: A temporary "workspace" for database operations. Created per request,
           then closed when the request finishes. Never share sessions between requests.
- Base:    The declarative base that all our models inherit from.

Usage in routes (via FastAPI dependency injection):
    def my_route(db: Session = Depends(get_db)):
        products = db.query(Product).all()
"""

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import StaticPool
from app.core.config import settings


# ─────────────────────────────────────────────────────────────────────────────
# Engine
# ─────────────────────────────────────────────────────────────────────────────

# connect_args={"check_same_thread": False}
#   SQLite by default only allows the thread that created it to use the connection.
#   FastAPI uses async workers, so we disable this restriction.
#   This is ONLY needed for SQLite; PostgreSQL handles threading automatically.

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
    # echo=True prints all SQL queries to the console — useful for debugging,
    # but set to False in production to avoid log spam.
    echo=settings.DEBUG,
)


# ─────────────────────────────────────────────────────────────────────────────
# Enable SQLite Foreign Key enforcement
# ─────────────────────────────────────────────────────────────────────────────
# SQLite does NOT enforce foreign keys by default — you have to turn it on
# for every connection. This event runs "PRAGMA foreign_keys=ON" automatically
# every time a connection is opened.
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


# ─────────────────────────────────────────────────────────────────────────────
# Session factory
# ─────────────────────────────────────────────────────────────────────────────

# SessionLocal is a factory that creates new Session objects on demand.
# autocommit=False:  We manually commit transactions, giving us full control.
# autoflush=False:   We manually flush, preventing unexpected queries mid-transaction.
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


# ─────────────────────────────────────────────────────────────────────────────
# Declarative Base
# ─────────────────────────────────────────────────────────────────────────────

# All SQLAlchemy models will inherit from this Base.
# Base.metadata.create_all(engine) creates all tables defined in models.
class Base(DeclarativeBase):
    pass


# ─────────────────────────────────────────────────────────────────────────────
# Dependency: get_db
# ─────────────────────────────────────────────────────────────────────────────

def get_db():
    """
    FastAPI dependency that provides a database session per request.

    The 'yield' pattern (a generator) ensures the session is ALWAYS closed
    after the request finishes, even if an exception is raised.

    Example usage in a route:
        @router.get("/products")
        def list_products(db: Session = Depends(get_db)):
            return db.query(Product).all()
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
