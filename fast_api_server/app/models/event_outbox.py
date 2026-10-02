from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class EventOutbox(Base):
    __tablename__ = "event_outbox"

    id = Column(String(64), primary_key=True, index=True)
    organization_id = Column(String(64), ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, index=True)
    event_id = Column(String(64), ForeignKey("canonical_events.id", ondelete="RESTRICT"), nullable=False, index=True)
    run_id = Column(String(64), default="run_live_001", nullable=False, index=True)
    topic = Column(String(128), default="company_brain:events", nullable=False)
    payload_json = Column(Text, nullable=False)
    status = Column(String(32), default="PENDING", nullable=False, index=True)  # PENDING, CLAIMED, PUBLISHED, FAILED
    claimed_at = Column(DateTime(timezone=True), nullable=True)
    claimed_by = Column(String(128), nullable=True)
    published_at = Column(DateTime(timezone=True), nullable=True)
    attempts = Column(Integer, default=0, nullable=False)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)

    organization = relationship("Organization")
    event = relationship("CanonicalEventModel")

    __table_args__ = (
        Index("ix_outbox_status_attempts_created", "status", "attempts", "created_at"),
    )
