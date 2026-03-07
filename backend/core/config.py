import os

from pydantic_settings import BaseSettings


BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(BACKEND_DIR))
DEFAULT_DATABASE_URL = f"sqlite:///{os.path.join(PROJECT_ROOT, 'data', 'netops.db').replace(os.sep, '/')}"

class Settings(BaseSettings):
    PROJECT_NAME: str = "NetOps Automation Platform"
    DATABASE_URL: str = DEFAULT_DATABASE_URL
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str = "supersecret"
    CREDENTIAL_ENCRYPTION_KEY: str = "change-me-to-a-random-secret"
    ENVIRONMENT: str = "development"
    TELEMETRY_RAW_RETENTION_HOURS: int = 48
    TELEMETRY_ROLLUP_RETENTION_DAYS: int = 365
    ALERT_INTERFACE_DOWN_ENABLED: bool = True
    ALERT_INTERFACE_UTIL_THRESHOLD: float = 85.0
    ALERT_NOTIFY_WEBHOOK_URL: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
