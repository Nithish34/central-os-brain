import json
from datetime import datetime, timezone
from typing import Dict, Any
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class CanonicalEventModel(Base):
    __tablename__ = "canonical_events"

    id = Column(String(64), primary_key=True, index=True)
    organization_id = Column(String(64), ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, index=True)
    provider = Column(String(32), nullable=False, index=True)
    event_type = Column(String(128), nullable=False, index=True)
    external_event_id = Column(String(255), nullable=True)
    external_account_id = Column(String(255), nullable=True)
    idempotency_key = Column(String(64), nullable=False, index=True)
    
    _actor = Column("actor", Text, default="{}", nullable=False)
    _source = Column("source", Text, default="{}", nullable=False)
    _payload = Column("payload", Text, default="{}", nullable=False)
    _metadata = Column("metadata", Text, default="{}", nullable=False)

    correlation_id = Column(String(64), nullable=False, index=True)
    causation_id = Column(String(64), nullable=True, index=True)
    schema_version = Column(String(16), default="1.0.0", nullable=False)

    occurred_at = Column(DateTime(timezone=True), nullable=False, index=True)
    received_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    organization = relationship("Organization")

    __table_args__ = (
        UniqueConstraint("organization_id", "idempotency_key", name="uq_canonical_org_idempotency"),
        Index("ix_canonical_org_provider", "organization_id", "provider"),
        Index("ix_canonical_org_occurred", "organization_id", "occurred_at"),
    )

    @property
    def actor(self) -> Dict[str, Any]:
        try:
            return json.loads(self._actor)
        except Exception:
            return {}

    @actor.setter
    def actor(self, value: Dict[str, Any]) -> None:
        self._actor = json.dumps(value)

    @property
    def source(self) -> Dict[str, Any]:
        try:
            return json.loads(self._source)
        except Exception:
            return {}

    @source.setter
    def source(self, value: Dict[str, Any]) -> None:
        self._source = json.dumps(value)

    @property
    def payload(self) -> Dict[str, Any]:
        try:
            return json.loads(self._payload)
        except Exception:
            return {}

    @payload.setter
    def payload(self, value: Dict[str, Any]) -> None:
        self._payload = json.dumps(value)

    @property
    def metadata_dict(self) -> Dict[str, Any]:
        try:
            return json.loads(self._metadata)
        except Exception:
            return {}

    @metadata_dict.setter
    def metadata_dict(self, value: Dict[str, Any]) -> None:
        self._metadata = json.dumps(value)
