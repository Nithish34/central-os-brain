import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class AgentProfile(Base):
    __tablename__ = "agents"

    id = Column(String(64), primary_key=True, index=True)
    organization_id = Column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    icon = Column(String(32), default="🤖", nullable=False)
    domain = Column(String(128), nullable=False, index=True)
    status = Column(String(32), default="active", nullable=False)  # active, monitoring, idle
    conflicts_detected = Column(Integer, default=0, nullable=False)
    last_detection = Column(String(64), nullable=True)
    memory_entries = Column(Integer, default=10, nullable=False)
    tasks_completed = Column(Integer, default=0, nullable=False)
    description = Column(Text, nullable=False)
    _detected_conflict_ids = Column("detected_conflict_ids", Text, default="[]", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    organization = relationship("Organization", back_populates="agents")

    @property
    def detected_conflict_ids(self) -> list[str]:
        try:
            return json.loads(self._detected_conflict_ids)
        except Exception:
            return []

    @detected_conflict_ids.setter
    def detected_conflict_ids(self, value: list[str]) -> None:
        self._detected_conflict_ids = json.dumps(value)
