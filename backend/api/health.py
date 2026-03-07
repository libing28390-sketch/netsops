from fastapi import APIRouter
from core.config import settings
from database import DB_PATH, get_db_connection
import logging
import os
import shutil

router = APIRouter()
logger = logging.getLogger(__name__)

@router.api_route("/health", methods=["GET", "HEAD"], tags=["health"])
async def health_check():
    logger.debug("Health check endpoint called")
    db_ok = False
    db_status = "missing"
    try:
        if os.path.exists(DB_PATH):
            conn = get_db_connection()
            conn.execute("SELECT 1").fetchone()
            conn.close()
            db_ok = True
            db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)[:100]}"

    # Disk space check
    disk = shutil.disk_usage(os.path.dirname(DB_PATH) or '.')
    disk_free_gb = round(disk.free / (1024**3), 2)
    disk_warn = disk_free_gb < 1.0

    overall = "healthy" if (db_ok and not disk_warn) else "degraded"

    return {
        "status": overall,
        "environment": settings.ENVIRONMENT,
        "project": settings.PROJECT_NAME,
        "database": db_status,
        "disk_free_gb": disk_free_gb,
        "disk_warning": disk_warn,
    }
