from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class EventDeadLetter(Base):
    __tablename__ = "event_dead_letters"

    id = Column(String(64), primary_key=True, index=True)
    organization_id = Column(String(64), ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, index=True)
    event_id = Column(String(64), ForeignKey("canonical_events.id", ondelete="RESTRICT"), nullable=False, index=True)
    consumer_group = Column(String(64), nullable=False, index=True)
    run_id = Column(String(64), default="run_live_001", nullable=False, index=True)
    failure_reason = Column(String(255), nullable=False)
    error_details = Column(Text, nullable=False)
    attempts = Column(Integer, default=5, nullable=False)
    payload_snapshot = Column(Text, nullable=False)
    failed_at = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_status = Column(String(32), default="UNRESOLVED", nullable=False, index=True)  # UNRESOLVED, RETRIED, DISCARDED

    organization = relationship("Organization")
    event = relationship("CanonicalEventModel")

    __table_args__ = (
        Index("ix_dead_letters_org_group", "organization_id", "consumer_group", "resolution_status"),
    )
