"""
FastAPI dependency functions for authentication and authorization.

HOW FASTAPI DEPENDENCIES WORK
──────────────────────────────
FastAPI's Depends() system lets you declare "prerequisites" for a route.
When a request arrives, FastAPI runs all dependencies first and injects
the results into the route function.

Example:
    @router.get("/products")
    def list_products(
        current_user: User = Depends(get_current_user),   # ← checks JWT
        db: Session = Depends(get_db),                     # ← opens DB session
    ):
        ...

If get_current_user raises an HTTPException, the route never runs.
This is how we protect routes without putting auth logic in every function.

DEPENDENCY CHAIN
────────────────
get_current_user
    └─ reads Authorization header
    └─ decodes JWT
    └─ loads User from DB
    └─ checks is_active

require_permission("create_sale")
    └─ calls get_current_user
    └─ checks user.has_permission("create_sale")
    └─ raises 403 if not allowed
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from jose import JWTError

from app.core.database import get_db
from app.auth.security import decode_token
from app.models.user import User

# HTTPBearer extracts the token from: Authorization: Bearer <token>
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency: Extract and validate the JWT token, return the User.

    Raises 401 if:
    - No token provided
    - Token is expired
    - Token is invalid/tampered
    - User no longer exists in DB
    - User account is deactivated
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated. Please log in.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials:
        raise credentials_exception

    try:
        payload = decode_token(credentials.credentials)
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except (JWTError, ValueError):
        raise credentials_exception

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    return user


def require_permission(permission: str):
    """
    Dependency factory: returns a dependency that enforces a specific permission.

    Usage:
        @router.post("/products")
        def create_product(
            _=Depends(require_permission("create_product")),
            current_user: User = Depends(get_current_user),
        ):
            ...

    If the user doesn't have "create_product" in their permissions list,
    FastAPI returns 403 Forbidden before the function body runs.
    """
    def _check(current_user: User = Depends(get_current_user)):
        if not current_user.has_permission(permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required: '{permission}'",
            )
        return current_user
    return _check


def require_any_role(*role_names: str):
    """
    Dependency factory: user must have at least one of the given roles.

    Usage:
        @router.delete("/users/{id}")
        def delete_user(_=Depends(require_any_role("ADMIN"))):
            ...
    """
    def _check(current_user: User = Depends(get_current_user)):
        user_role_names = [r.name for r in current_user.roles]
        if not any(r in user_role_names for r in role_names):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access restricted to roles: {', '.join(role_names)}",
            )
        return current_user
    return _check
