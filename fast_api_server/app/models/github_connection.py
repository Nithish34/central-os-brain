from datetime import datetime, timezone
import json
from typing import Dict, Any, Optional, List
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.security import encryption_manager


def utcnow():
    return datetime.now(timezone.utc)


class GitHubConnection(Base):
    __tablename__ = "github_connections"

    id: Any = Column(String(64), primary_key=True, index=True)
    user_id: Any = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    organization_id: Any = Column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    github_user_id: Any = Column(String(64), nullable=True)
    github_login: Any = Column(String(255), nullable=True)
    github_installation_id: Any = Column(String(64), nullable=True)
    access_token: Any = Column(Text, nullable=False)  # Encrypted GitHub personal/bot/app access token
    is_active: Any = Column(Boolean, default=True, nullable=False, index=True)
    synced_repos: Any = Column(Text, default="[]", nullable=False)  # JSON list of repositories e.g. ["owner/repo"]
    cursor_state: Any = Column(Text, default="{}", nullable=False)  # JSON tracking commit SHAs or pagination cursors
    last_polled_at: Any = Column(DateTime(timezone=True), nullable=True)
    created_at: Any = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Any = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    user = relationship("User", backref="github_connections")

    __table_args__ = (
        Index("ix_github_conn_user_active", "user_id", "is_active"),
        Index("ix_github_conn_org_active", "organization_id", "is_active"),
    )

    def set_token(self, token_str: str) -> None:
        """Encrypt and store access token at rest."""
        self.access_token = encryption_manager.encrypt(token_str)

    def get_token(self) -> str:
        """Decrypt and return plaintext access token."""
        return encryption_manager.decrypt(self.access_token)

    def get_synced_repos(self) -> List[str]:
        """Return list of tracked repositories."""
        if not self.synced_repos:
            return []
        try:
            return json.loads(self.synced_repos)
        except Exception:
            return []

    def set_synced_repos(self, repos: List[str]) -> None:
        """Update tracked repositories list."""
        self.synced_repos = json.dumps(repos)

    def get_cursor_state(self) -> Dict[str, Any]:
        """Return dict of repository cursors / commit SHAs."""
        if not self.cursor_state:
            return {}
        try:
            return json.loads(self.cursor_state)
        except Exception:
            return {}

    def set_cursor_state(self, state: Dict[str, Any]) -> None:
        """Update repository cursors."""
        self.cursor_state = json.dumps(state)
