"""
Backup & Restore endpoints — Phase 13.

POST /backup/create               → copy the SQLite DB file to backups/
GET  /backup/list                 → list all backup files with name/size/created_at
GET  /backup/download/{filename}  → download a backup file
POST /backup/restore              → upload a .db file and replace the live DB

SAFETY:
- Restore replaces the live DB atomically: writes to a .tmp file first,
  then renames over the original only if the upload succeeds.
- Only .db files are accepted for restore.
- All endpoints require manage_backup permission.
- Filename inputs are sanitised to prevent path traversal.
"""

import os
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from app.core.config import settings
from app.core.database import engine
from app.auth.dependencies import require_permission
from app.models.user import User

router = APIRouter()

# Resolve the SQLite file path from the DATABASE_URL
# e.g. "sqlite:///E:/foo/data/inventory.db" → Path("E:/foo/data/inventory.db")
def _db_path() -> Path:
    url = settings.DATABASE_URL
    # Strip "sqlite:///" prefix (absolute path on all platforms)
    if url.startswith("sqlite:///"):
        return Path(url[len("sqlite:///"):])
    raise RuntimeError(f"Unsupported DATABASE_URL for backup: {url}")


def _safe_filename(name: str) -> str:
    """Strip any path components — only allow the bare filename."""
    return Path(name).name


# ── Create backup ─────────────────────────────────────────────────────────────

@router.post("/create")
def create_backup(
    current_user: User = Depends(require_permission("manage_backup")),
):
    """
    Copy the live SQLite database file into the backups/ directory.

    Filename format: inventory_backup_YYYYMMDD_HHMMSS.db
    Returns metadata about the newly created backup.
    """
    db_path = _db_path()
    if not db_path.exists():
        raise HTTPException(status_code=404, detail="Database file not found")

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_name = f"inventory_backup_{ts}.db"
    backup_path = settings.BACKUP_DIR / backup_name

    # SQLite WAL checkpoint: flush WAL to main DB before copying
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("PRAGMA wal_checkpoint(TRUNCATE)"))
    except Exception:
        pass  # Non-fatal; proceed with copy anyway

    shutil.copy2(str(db_path), str(backup_path))

    stat = backup_path.stat()
    return {
        "filename":   backup_name,
        "size_bytes": stat.st_size,
        "size_human": _human_size(stat.st_size),
        "created_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        "message":    f"Backup created: {backup_name}",
    }


# ── List backups ──────────────────────────────────────────────────────────────

@router.get("/list")
def list_backups(
    current_user: User = Depends(require_permission("manage_backup")),
):
    """List all backup files in backups/ directory, newest first."""
    backup_dir = settings.BACKUP_DIR
    backups = []

    for f in sorted(backup_dir.iterdir(), reverse=True):
        if f.is_file() and f.suffix == ".db":
            stat = f.stat()
            backups.append({
                "filename":   f.name,
                "size_bytes": stat.st_size,
                "size_human": _human_size(stat.st_size),
                "created_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
            })

    return {"count": len(backups), "backups": backups}


# ── Download backup ───────────────────────────────────────────────────────────

@router.get("/download/{filename}")
def download_backup(
    filename: str,
    current_user: User = Depends(require_permission("manage_backup")),
):
    """Download a specific backup file."""
    safe = _safe_filename(filename)
    if not safe.endswith(".db"):
        raise HTTPException(status_code=400, detail="Only .db files can be downloaded")

    path = settings.BACKUP_DIR / safe
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Backup file not found")

    return FileResponse(
        path=str(path),
        media_type="application/octet-stream",
        filename=safe,
        headers={"Content-Disposition": f'attachment; filename="{safe}"'},
    )


# ── Restore ───────────────────────────────────────────────────────────────────

@router.post("/restore")
async def restore_backup(
    file: UploadFile = File(..., description="SQLite .db backup file to restore"),
    current_user: User = Depends(require_permission("restore_backup")),
):
    """
    Replace the live database with an uploaded backup.

    Process:
      1. Validate upload is a .db file
      2. Write uploaded bytes to a .tmp file next to the live DB
      3. Dispose SQLAlchemy engine connections
      4. Rename .tmp over the live DB (atomic on same filesystem)
      5. Return success — the server must be restarted to reconnect

    WARNING: This replaces ALL live data. Make a backup first.
    """
    if not file.filename or not file.filename.endswith(".db"):
        raise HTTPException(status_code=400, detail="Only .db files are accepted for restore")

    db_path = _db_path()
    tmp_path = db_path.with_suffix(".db.restoring")

    try:
        contents = await file.read()
        if len(contents) < 100:
            raise HTTPException(status_code=400, detail="File too small — not a valid SQLite database")

        # Validate SQLite magic header ("SQLite format 3\000")
        if not contents[:16].startswith(b"SQLite format 3"):
            raise HTTPException(status_code=400, detail="Not a valid SQLite database file")

        # Write to temp file
        tmp_path.write_bytes(contents)

        # Dispose all SQLAlchemy connections so the file lock is released
        engine.dispose()

        # Atomic replace
        os.replace(str(tmp_path), str(db_path))

    except HTTPException:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
        raise
    except Exception as exc:
        if tmp_path.exists():
            tmp_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Restore failed: {exc}")

    return {
        "message": "Database restored successfully. Please restart the server to reconnect.",
        "filename": file.filename,
        "size_bytes": len(contents),
    }


# ── Delete backup ─────────────────────────────────────────────────────────────

@router.delete("/delete/{filename}")
def delete_backup(
    filename: str,
    current_user: User = Depends(require_permission("manage_backup")),
):
    """Permanently delete a backup file."""
    safe = _safe_filename(filename)
    if not safe.endswith(".db"):
        raise HTTPException(status_code=400, detail="Only .db files can be deleted")

    path = settings.BACKUP_DIR / safe
    if not path.exists():
        raise HTTPException(status_code=404, detail="Backup not found")

    path.unlink()
    return {"message": f"Deleted {safe}"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _human_size(size_bytes: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"
