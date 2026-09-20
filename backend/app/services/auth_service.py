"""
Auth service — business logic for authentication.

Services sit between the API endpoints and the database models.
They contain the business rules (e.g., "you can't log in if is_active=False")
so that endpoints stay thin and readable.

The dependency chain is:
    HTTP Request
        → Endpoint (validates input via schema)
            → Service (applies business rules)
                → SQLAlchemy model (reads/writes database)
"""

from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User, Role, UserRole
from app.models.business import Business
from app.auth.security import verify_password, hash_password, create_access_token
from app.schemas.auth import LoginRequest, LoginResponse, UserResponse


def authenticate_user(db: Session, username: str, password: str) -> User:
    """
    Verify username + password. Returns the User on success.
    Raises HTTPException 401 on any failure.

    We intentionally give the same error message for wrong username
    and wrong password — this prevents attackers from knowing which
    part was wrong (username enumeration attack).
    """
    user = db.query(User).filter(User.username == username).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated. Contact your administrator.",
        )

    return user


def login(db: Session, credentials: LoginRequest) -> LoginResponse:
    """
    Full login flow:
    1. Verify credentials
    2. Update last_login timestamp
    3. Create JWT access token
    4. Return token + user profile
    """
    user = authenticate_user(db, credentials.username, credentials.password)

    # Update last login time
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    # Build JWT payload
    # "sub" (subject) is the standard JWT claim for identifying the user
    token = create_access_token({
        "sub": str(user.id),
        "username": user.username,
        "business_id": user.business_id,
    })

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


def get_user_by_id(db: Session, user_id: int) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def create_user(
    db: Session,
    username: str,
    password: str,
    business_id: int,
    role_name: str = "STAFF",
    full_name: str | None = None,
    email: str | None = None,
    phone: str | None = None,
) -> User:
    """
    Create a new user and assign them a role.
    Raises 409 if username already exists.
    """
    existing = get_user_by_username(db, username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Username '{username}' is already taken",
        )

    # Find the role by name for this business
    role = db.query(Role).filter(
        Role.business_id == business_id,
        Role.name == role_name.upper(),
    ).first()
    if not role:
        raise HTTPException(
            status_code=404,
            detail=f"Role '{role_name}' not found. Create it first.",
        )

    user = User(
        business_id=business_id,
        username=username,
        hashed_password=hash_password(password),
        full_name=full_name,
        email=email,
        phone=phone,
        is_active=True,
    )
    db.add(user)
    db.flush()  # get user.id without committing

    user_role = UserRole(user_id=user.id, role_id=role.id)
    db.add(user_role)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user: User, **kwargs) -> User:
    """Update user fields. Pass only the fields you want to change."""
    for key, value in kwargs.items():
        if value is not None and hasattr(user, key):
            setattr(user, key, value)
    db.commit()
    db.refresh(user)
    return user


def change_password(
    db: Session,
    user: User,
    current_password: str,
    new_password: str,
) -> None:
    """Verify current password then set new one."""
    if not verify_password(current_password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    user.hashed_password = hash_password(new_password)
    db.commit()


def reset_user_password(
    db: Session,
    user: User,
    new_password: str,
) -> None:
    """Admin resets a user's password directly."""
    user.hashed_password = hash_password(new_password)
    db.commit()


def deactivate_user(db: Session, user: User, requesting_user: User) -> User:
    """Soft-delete: set is_active=False. Cannot deactivate yourself."""
    if user.id == requesting_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate your own account",
        )
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user


def assign_role(db: Session, user: User, role: Role) -> User:
    """Replace the user's current role with a new one."""
    # Remove existing roles
    db.query(UserRole).filter(UserRole.user_id == user.id).delete()
    user_role = UserRole(user_id=user.id, role_id=role.id)
    db.add(user_role)
    db.commit()
    db.refresh(user)
    return user
