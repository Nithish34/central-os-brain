import json
from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class IntegrationProvider(str, Enum):
    SLACK = "slack"
    GITHUB = "github"
    NOTION = "notion"
    JIRA = "jira"
    TEAMS = "teams"
    GMAIL = "gmail"


class IntegrationStatusEnum(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    SYNCING = "syncing"
    ERROR = "error"


class IntegrationAccount(Base):
    __tablename__ = "integrations"

    id = Column(String(64), primary_key=True, index=True)
    organization_id = Column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(String(32), nullable=False, index=True)  # slack, github, notion, jira, teams, gmail
    name = Column(String(255), nullable=False)
    status = Column(String(32), default=IntegrationStatusEnum.DISCONNECTED.value, nullable=False, index=True)
    account_id = Column(String(255), nullable=True)
    account_name = Column(String(255), nullable=True)
    encrypted_access_token = Column(Text, nullable=True)
    encrypted_refresh_token = Column(Text, nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=True)
    _scopes = Column("scopes", Text, default="[]", nullable=False)
    events_ingested = Column(Integer, default=0, nullable=False)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    sync_status_message = Column(Text, nullable=True)
    webhook_secret = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    organization = relationship("Organization", back_populates="integrations")

    __table_args__ = (
        Index("ix_integrations_org_provider", "organization_id", "provider", unique=True),
    )

    @property
    def scopes(self) -> List[str]:
        try:
            return json.loads(self._scopes)
        except Exception:
            return []

    @scopes.setter
    def scopes(self, value: List[str]) -> None:
        self._scopes = json.dumps(value)
