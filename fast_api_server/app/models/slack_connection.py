from datetime import datetime, timezone
import json
from typing import Dict, Any, Optional
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship

from app.core.database import Base
from app.core.security import encryption_manager


def utcnow():
    return datetime.now(timezone.utc)


class SlackConnection(Base):
    __tablename__ = "slack_connections"

    id: Any = Column(String(64), primary_key=True, index=True)
    user_id: Any = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    slack_team_id: Any = Column(String(64), nullable=False, index=True)
    slack_user_id: Any = Column(String(64), nullable=True)
    access_token: Any = Column(Text, nullable=False)  # Encrypted Slack bot access token
    is_active: Any = Column(Boolean, default=True, nullable=False, index=True)
    cursor_state: Any = Column(Text, default="{}", nullable=False)  # JSON tracking channel cursor/last message ts
    last_polled_at: Any = Column(DateTime(timezone=True), nullable=True)
    created_at: Any = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Any = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    user = relationship("User", backref="slack_connections")

    __table_args__ = (
        Index("ix_slack_conn_user_team", "user_id", "slack_team_id"),
        Index("ix_slack_conn_user_active", "user_id", "is_active"),
    )

    def set_token(self, token_str: str) -> None:
        """Encrypt and store access token at rest."""
        self.access_token = encryption_manager.encrypt(token_str)

    def get_token(self) -> str:
        """Decrypt and return plaintext access token."""
        return encryption_manager.decrypt(self.access_token)

    def get_channel_cursors(self) -> Dict[str, str]:
        """Return dict of channel_id -> last_processed_message_ts."""
        if not self.cursor_state:
            return {}
        try:
            return json.loads(self.cursor_state)
        except Exception:
            return {}

    def set_channel_cursor(self, channel_id: str, last_ts: str) -> None:
        """Update last processed timestamp for a channel."""
        cursors = self.get_channel_cursors()
        cursors[channel_id] = str(last_ts)
        self.cursor_state = json.dumps(cursors)
