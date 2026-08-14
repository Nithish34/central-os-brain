from pathlib import Path
from typing import Optional, List
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT_DIR = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    # Server
    HOST: str = "127.0.0.1"
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
    CORS_ALLOWED_ORIGINS: List[str] = ["*"]

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

    # Layer 2: Intelligence Core (Optional Live LLM Providers)
    OPENAI_API_KEY: Optional[str] = None
    GEMINI_API_KEY: Optional[str] = None
    ANTHROPIC_API_KEY: Optional[str] = None
    LLM_MODEL: str = "gpt-4o-mini"
    EMBEDDING_MODEL: str = "text-embedding-3-small"

    # Layer 0: Execution Connectors
    SLACK_WEBHOOK_URL: Optional[str] = None
    GITHUB_TOKEN: Optional[str] = None
    GITHUB_REPO: Optional[str] = None
    JIRA_INSTANCE_URL: Optional[str] = None
    JIRA_API_TOKEN: Optional[str] = None
    JIRA_USER_EMAIL: Optional[str] = None

    model_config = SettingsConfigDict(
        env_file=str(ROOT_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
