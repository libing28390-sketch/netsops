from fastapi import APIRouter
from core.config import settings
from database import DB_PATH
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.api_route("/health", methods=["GET", "HEAD"], tags=["health"])
async def health_check():
    logger.debug("Health check endpoint called")
    import os
    db_exists = os.path.exists(DB_PATH)
    return {
        "status": "healthy",
        "environment": settings.ENVIRONMENT,
        "project": settings.PROJECT_NAME,
        "database": "connected" if db_exists else "missing"
    }
