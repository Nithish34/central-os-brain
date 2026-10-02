import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Boolean, Text, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class CompanyEvent(Base):
    __tablename__ = "events"

    id = Column(String(64), primary_key=True, index=True)
    organization_id = Column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_event_id = Column(String(255), nullable=True, index=True)
    source = Column(String(64), nullable=False, index=True)  # Slack, GitHub, Jira, etc.
    type = Column(String(64), nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    author = Column(String(255), nullable=False)
    owner = Column(String(255), nullable=False, index=True)
    timestamp = Column(String(64), nullable=False)
    authority_score = Column(Float, default=0.85, nullable=False)
    freshness_score = Column(Float, default=0.95, nullable=False)
    _tags = Column("tags", Text, default="[]", nullable=False)

    # Layer 3 & Layer 4 Pipeline metadata
    pipeline_stage = Column(String(64), default="processed", nullable=False)  # queued, routed, processed
    event_type_normalized = Column(String(64), default="operational_decision", nullable=False)
    ingestion_source = Column(String(64), default="connector", nullable=False)
    vector_indexed = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    organization = relationship("Organization", back_populates="events")

    __table_args__ = (
        Index("ix_events_org_source", "organization_id", "source"),
        Index("ix_events_org_provider_event", "organization_id", "source", "provider_event_id", unique=False),
    )

    @property
    def tags(self) -> list[str]:
        try:
            return json.loads(self._tags)
        except Exception:
            return []

    @tags.setter
    def tags(self, value: list[str]) -> None:
        self._tags = json.dumps(value)
