from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql://postgres:talentlens@db:5432/talentlens"

    # JWT
    secret_key: str = "CHANGE-ME-IN-PRODUCTION-USE-LONG-RANDOM-STRING"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60
    refresh_token_expire_days: int = 7

    # Anthropic LLM
    anthropic_api_key: str = ""
    llm_model: str = "claude-sonnet-4-20250514"

    # File uploads
    upload_dir: str = "/app/uploads"
    max_upload_size_mb: int = 5

    # App
    app_name: str = "TalentLens"
    frontend_url: str = "http://localhost:3000"
    environment: str = "development"

    # Email (SMTP - optional)
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: str = "noreply@talentlens.io"

    class Config:
        env_file = ".env"

settings = Settings()
