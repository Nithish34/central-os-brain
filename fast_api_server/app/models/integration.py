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


from typing import List, Optional, Any

class IntegrationAccount(Base):
    __tablename__ = "integrations"

    id: Any = Column(String(64), primary_key=True, index=True)
    organization_id: Any = Column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    provider: Any = Column(String(32), nullable=False, index=True)  # slack, github, notion, jira, teams, gmail
    name: Any = Column(String(255), nullable=False)
    status: Any = Column(String(32), default=IntegrationStatusEnum.DISCONNECTED.value, nullable=False, index=True)
    account_id: Any = Column(String(255), nullable=True)
    account_name: Any = Column(String(255), nullable=True)
    encrypted_access_token: Any = Column(Text, nullable=True)
    encrypted_refresh_token: Any = Column(Text, nullable=True)
    token_expires_at: Any = Column(DateTime(timezone=True), nullable=True)
    _scopes: Any = Column("scopes", Text, default="[]", nullable=False)
    events_ingested: Any = Column(Integer, default=0, nullable=False)
    last_sync_at: Any = Column(DateTime(timezone=True), nullable=True)
    sync_status_message: Any = Column(Text, nullable=True)
    webhook_secret: Any = Column(String(255), nullable=True)
    created_at: Any = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Any = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

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
