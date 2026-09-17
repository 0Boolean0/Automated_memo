"""
Import all models here so Alembic can detect them for migrations.
Every time you add a new model file, import it in this __init__.py.
"""

from app.models.business import Business
from app.models.user import User, Role, UserRole
