"""
Business settings endpoints.

GET /business        → get current business info
PUT /business        → update business info (Admin only)
POST /business/logo  → upload logo (Admin only)
"""

import shutil
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.auth.dependencies import get_current_user, require_any_role
from app.models.user import User
from app.models.business import Business
from app.schemas.auth import BusinessUpdate, BusinessResponse

router = APIRouter()


@router.get("/", response_model=BusinessResponse)
def get_business(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current business profile. All authenticated users can read this."""
    business = db.query(Business).filter(
        Business.id == current_user.business_id
    ).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
    return business


@router.put("/", response_model=BusinessResponse)
def update_business(
    data: BusinessUpdate,
    current_user: User = Depends(require_any_role("ADMIN")),
    db: Session = Depends(get_db),
):
    """Update business info. Admin only."""
    business = db.query(Business).filter(
        Business.id == current_user.business_id
    ).first()
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")

    update_data = data.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(business, key, value)

    db.commit()
    db.refresh(business)
    return business


@router.post("/logo", response_model=BusinessResponse)
def upload_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(require_any_role("ADMIN")),
    db: Session = Depends(get_db),
):
    """
    Upload a business logo image.
    Accepted formats: jpg, jpeg, png, webp, svg
    Max size is enforced by the web server config (set in uvicorn/nginx).
    """
    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp", ".svg"}
    suffix = Path(file.filename).suffix.lower()
    if suffix not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Use: {', '.join(allowed_extensions)}",
        )

    # Save to static/logos/ — served as /static/logos/filename
    logos_dir = settings.STATIC_DIR / "logos"
    logos_dir.mkdir(parents=True, exist_ok=True)

    filename = f"business_{current_user.business_id}{suffix}"
    save_path = logos_dir / filename

    with save_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Store relative URL — frontend prepends the base URL
    logo_url = f"/static/logos/{filename}"

    business = db.query(Business).filter(
        Business.id == current_user.business_id
    ).first()
    business.logo_url = logo_url
    db.commit()
    db.refresh(business)
    return business
