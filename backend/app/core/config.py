from pathlib import Path
from typing import Optional, List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    APP_NAME: str = "Company Brain OS"
    API_V1_STR: str = "/api/v1"

    # Layer 5: Gateway, JWT Auth & RBAC
    JWT_SECRET: str = "company-brain-secret-key-change-in-production-2026"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRES_MINUTES: int = 60 * 24  # 24 hours
    JWT_ISSUER: str = "company-brain-gateway"
    JWT_AUDIENCE: str = "company-brain-api"
    ADMIN_BOOTSTRAP_EMAIL: str = "admin@companybrain.local"
    ADMIN_BOOTSTRAP_PASSWORD: str = "admin1234"
    CORS_ALLOWED_ORIGINS: Union[List[str], str] = ["*"]

    # Layer 4: Ingestion Connectors & Webhooks
    LAYER4_BASE_URL: str = "http://localhost:3000"
    SLACK_SIGNING_SECRET: Optional[str] = "slack_demo_secret_2026"
    GITHUB_WEBHOOK_SECRET: Optional[str] = "github_demo_secret_2026"
    TEAMS_CLIENT_SECRET: Optional[str] = "teams_demo_secret_2026"
    GMAIL_PUBSUB_VERIFICATION_TOKEN: Optional[str] = "gmail_demo_token_2026"

    # Layer 1: Data Foundation
    DATABASE_URL: str = f"sqlite:///{ROOT_DIR / 'company_brain.db'}"
    REDIS_URL: str = "redis://localhost:6379/0"
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "companybrain123"

    # Layer 2: Intelligence Core (Google Gemini Live LLM)
    GEMINI_API_KEY: Optional[str] = None
    LLM_MODEL: str = "gemini-2.5-flash"
    EMBEDDING_MODEL: str = "text-embedding-3-small"

    # Layer 0: Execution Connectors
    SLACK_WEBHOOK_URL: Optional[str] = None
    GITHUB_TOKEN: Optional[str] = None
    GITHUB_REPO: Optional[str] = None
    JIRA_INSTANCE_URL: Optional[str] = None
    JIRA_API_TOKEN: Optional[str] = None
    JIRA_USER_EMAIL: Optional[str] = None

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def assemble_db_connection(cls, v: Optional[str]) -> str:
        if isinstance(v, str) and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v or f"sqlite:///{ROOT_DIR / 'company_brain.db'}"

    @field_validator("CORS_ALLOWED_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            return v
        return ["*"]

    model_config = SettingsConfigDict(
        env_file=str(ROOT_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

