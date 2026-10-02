from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class EventProcessingState(Base):
    __tablename__ = "event_processing"

    id = Column(String(64), primary_key=True, index=True)
    organization_id = Column(String(64), ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, index=True)
    event_id = Column(String(64), ForeignKey("canonical_events.id", ondelete="RESTRICT"), nullable=False, index=True)
    consumer_group = Column(String(64), nullable=False, index=True)
    run_id = Column(String(64), default="run_live_001", nullable=False, index=True)
    run_type = Column(String(32), default="LIVE", nullable=False)  # LIVE, REPLAY
    status = Column(String(32), default="PENDING", nullable=False, index=True)  # PENDING, PROCESSING, COMPLETED, FAILED, DEAD_LETTER
    attempt_count = Column(Integer, default=1, nullable=False)
    worker_id = Column(String(128), default="worker-1", nullable=False)
    last_error = Column(Text, nullable=True)
    error_code = Column(String(64), nullable=True)
    first_attempt_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    last_attempt_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    processed_at = Column(DateTime(timezone=True), nullable=True)
    next_retry_at = Column(DateTime(timezone=True), nullable=True)

    organization = relationship("Organization")
    event = relationship("CanonicalEventModel")

    __table_args__ = (
        UniqueConstraint("event_id", "consumer_group", "run_id", name="uq_event_group_run"),
        Index("ix_event_proc_group_status", "consumer_group", "status"),
        Index("ix_event_proc_retry", "status", "next_retry_at"),
    )
