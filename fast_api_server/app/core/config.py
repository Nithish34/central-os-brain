import os
from pathlib import Path
from typing import Optional, List, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Base directories
CORE_DIR = Path(__file__).resolve().parent
APP_DIR = CORE_DIR.parent
SERVER_DIR = APP_DIR.parent
ROOT_DIR = SERVER_DIR.parent


def get_environment() -> str:
    return os.getenv("ENVIRONMENT", os.getenv("APP_ENV", "development")).lower()


class Settings(BaseSettings):
    # Server & Core Environment
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    APP_NAME: str = "Company Brain OS"
    API_V1_STR: str = "/api/v1"

    # Database (PostgreSQL default)
    DATABASE_URL: str = "postgresql://postgres:postgrespassword@localhost:5432/company_brain"
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_RECYCLE: int = 3600
    DB_POOL_PRE_PING: bool = True

    # Caching & State Storage (Redis)
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 20
    REDIS_TIMEOUT_SECONDS: int = 5

    # Encryption at Rest (Versioned Fernet/AES keys)
    # e.g., "v1:VGhpcy1pcy1hLTMyLWJ5dGUtZGV2LWtleS0xMjM0NTY3OA=="
    ENCRYPTION_KEY_CURRENT: str = "v1:VGhpcy1pcy1hLTMyLWJ5dGUtZGV2LWtleS0xMjM0NTY3OA=="
    ENCRYPTION_KEY_RETIRED: Optional[str] = None  # Comma-separated list of retired versioned keys

    # Authentication & Session
    JWT_SECRET: str = "company-brain-secret-key-change-in-production-2026"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRES_MINUTES: int = 60 * 24  # 24 hours
    JWT_ISSUER: str = "company-brain-auth"
    JWT_AUDIENCE: str = "company-brain-api"
    JWT_COOKIE_NAME: str = "cb_access_token"
    JWT_COOKIE_SECURE: bool = False  # True in production
    JWT_COOKIE_SAMESITE: str = "lax"
    
    # CSRF Protection
    CSRF_COOKIE_NAME: str = "cb_csrf_token"
    CSRF_HEADER_NAME: str = "X-CSRF-Token"

    # Rate Limiting
    AUTH_RATE_LIMIT_PER_MINUTE: int = 60
    PUBLIC_RATE_LIMIT_PER_MINUTE: int = 120

    # Bootstrap Admin
    ADMIN_BOOTSTRAP_EMAIL: str = "admin@companybrain.local"
    ADMIN_BOOTSTRAP_PASSWORD: str = "AdminSecurePassword123!"

    # CORS
    CORS_ALLOWED_ORIGINS: Union[List[str], str] = ["*"]

    # OAuth Providers
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GOOGLE_REDIRECT_URI: Optional[str] = None
    MICROSOFT_CLIENT_ID: Optional[str] = None
    MICROSOFT_CLIENT_SECRET: Optional[str] = None
    MICROSOFT_TENANT_ID: str = "common"

    # Connectors & Webhook Signing Secrets
    SLACK_CLIENT_ID: Optional[str] = None
    SLACK_CLIENT_SECRET: Optional[str] = None
    SLACK_SIGNING_SECRET: Optional[str] = "slack_demo_secret_2026"
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    GITHUB_WEBHOOK_SECRET: Optional[str] = "github_demo_secret_2026"
    TEAMS_CLIENT_SECRET: Optional[str] = "teams_demo_secret_2026"
    GMAIL_PUBSUB_VERIFICATION_TOKEN: Optional[str] = "gmail_demo_token_2026"

    # LLM and Legacy Optional Keys
    GEMINI_API_KEY: Optional[str] = None
    LLM_MODEL: str = "gemini-2.5-flash"
    EMBEDDING_MODEL: str = "text-embedding-3-small"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: Optional[str]) -> str:
        if isinstance(v, str) and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v or "postgresql://postgres:postgrespassword@localhost:5432/company_brain"

    @field_validator("CORS_ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["*"]

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.ENVIRONMENT == "production":
            self.JWT_COOKIE_SECURE = True
            if self.JWT_SECRET in [
                "company-brain-secret-key-change-in-production-2026",
                "test-jwt-secret-key-32-chars-long-2026-testing",
            ]:
                raise ValueError("JWT_SECRET must be set to a secure unique secret in production.")
            if not self.ADMIN_BOOTSTRAP_PASSWORD:
                raise ValueError("ADMIN_BOOTSTRAP_PASSWORD must be explicitly provided in production.")
        return self

    model_config = SettingsConfigDict(
        env_file=(
            str(ROOT_DIR / f".env.{get_environment()}"),
            str(ROOT_DIR / ".env"),
        ),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
