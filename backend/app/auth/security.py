"""
Security utilities: password hashing and JWT token handling.

PASSWORD HASHING
────────────────
We use bcrypt via passlib. Bcrypt is a slow hash algorithm — intentionally.
That slowness makes brute-force attacks expensive. Never use MD5/SHA1 for passwords.

Usage:
    hashed = hash_password("mypassword")
    is_valid = verify_password("mypassword", hashed)  # True

JWT TOKENS
──────────
JSON Web Token (JWT) is a signed string that proves who the user is.
Structure: header.payload.signature

Example payload:
    {"sub": "1", "username": "admin", "exp": 1727000000}

The server signs the token with SECRET_KEY. When the client sends it back,
the server verifies the signature to prove it hasn't been tampered with.

Two tokens:
- Access token:  short-lived (60 min), sent in Authorization header
- Refresh token: long-lived (7 days), used to get a new access token
"""

from datetime import datetime, timedelta, timezone
from typing import Any
from passlib.context import CryptContext
from jose import JWTError, jwt
from app.core.config import settings

# ─── Password hashing ────────────────────────────────────────────────────────

# CryptContext handles multiple schemes — bcrypt is the active one.
# deprecated="auto" means old hashes get upgraded automatically.
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain_password: str) -> str:
    """Hash a plain-text password. Call this before storing in DB."""
    return pwd_context.hash(plain_password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Check if a plain password matches a stored hash."""
    return pwd_context.verify(plain_password, hashed_password)


# ─── JWT tokens ──────────────────────────────────────────────────────────────

def create_access_token(data: dict[str, Any]) -> str:
    """
    Create a signed JWT access token.

    Args:
        data: Payload dict. Should include "sub" (user id as string).

    Returns:
        Signed JWT string.
    """
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
    })
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: dict[str, Any]) -> str:
    """
    Create a signed JWT refresh token (longer-lived).
    """
    payload = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
    })
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """
    Decode and verify a JWT token.

    Raises:
        JWTError: if the token is invalid, expired, or tampered with.

    Returns:
        The decoded payload dict.
    """
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
