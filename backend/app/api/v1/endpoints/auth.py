"""
Authentication endpoints.

POST /auth/login         → get JWT token
POST /auth/logout        → client discards token (stateless JWT)
GET  /auth/me            → get current user profile
PUT  /auth/me            → update own profile
POST /auth/change-password → change own password
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.auth.dependencies import get_current_user
from app.models.user import User
from app.schemas.auth import (
    LoginRequest, LoginResponse, UserResponse,
    UserUpdate, ChangePasswordRequest,
)
from app.services import auth_service

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
    """
    Login with username + password.
    Returns a JWT access token and the full user profile.

    The token must be sent in future requests as:
        Authorization: Bearer <token>
    """
    return auth_service.login(db, credentials)


@router.post("/logout")
def logout():
    """
    JWT tokens are stateless — the server doesn't store them.
    Logout is handled client-side by deleting the token from localStorage.
    This endpoint exists so the frontend has a clean API call to make.

    Future enhancement: maintain a token blacklist in Redis for true server-side logout.
    """
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Return the currently authenticated user's profile.
    Requires a valid JWT token in the Authorization header.
    """
    return current_user


@router.put("/me", response_model=UserResponse)
def update_me(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update your own profile (name, email, phone). Cannot change your own role here."""
    updated = auth_service.update_user(
        db, current_user,
        full_name=data.full_name,
        email=data.email,
        phone=data.phone,
    )
    return updated


@router.post("/change-password", status_code=200)
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change your own password. Requires the current password to confirm identity."""
    auth_service.change_password(
        db, current_user,
        current_password=data.current_password,
        new_password=data.new_password,
    )
    return {"message": "Password changed successfully"}
