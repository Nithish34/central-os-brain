import json
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from app.core.database import Base


class ChatSessionModel(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False, default="New Conversation")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_active = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    message_count = Column(Integer, default=0)
    is_archived = Column(Boolean, default=False)

    messages = relationship("ChatMessageModel", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessageModel.timestamp.asc()")

    def to_dict(self):
        return {
            "session_id": self.id,
            "title": self.title,
            "message_count": self.message_count or len(self.messages),
            "created_at": self.created_at.isoformat() if isinstance(self.created_at, datetime) else str(self.created_at),
            "last_active": self.last_active.isoformat() if isinstance(self.last_active, datetime) else str(self.last_active),
            "is_archived": self.is_archived,
        }


class ChatMessageModel(Base):
    __tablename__ = "chat_messages"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String, ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, nullable=False)  # "user" | "bot"
    text = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    engine = Column(String, nullable=True)  # e.g., "gemini-1.5-flash", "cognitive-nlp-engine"
    _sources = Column("sources", Text, default="[]")

    session = relationship("ChatSessionModel", back_populates="messages")

    @property
    def sources(self) -> list:
        try:
            return json.loads(self._sources) if self._sources else []
        except Exception:
            return []

    @sources.setter
    def sources(self, value: list) -> None:
        self._sources = json.dumps(value or [])

    def to_dict(self):
        return {
            "id": self.id,
            "role": self.role,
            "text": self.text,
            "timestamp": self.timestamp.isoformat() if isinstance(self.timestamp, datetime) else str(self.timestamp),
            "engine": self.engine,
            "sources": self.sources,
        }
