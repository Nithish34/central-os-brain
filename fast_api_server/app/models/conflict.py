import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Conflict(Base):
    __tablename__ = "conflicts"

    id = Column(String(64), primary_key=True, index=True)
    organization_id = Column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    severity = Column(String(32), default="medium", nullable=False, index=True)  # critical, high, medium, low
    domain = Column(String(128), nullable=False, index=True)
    document_id = Column(String(64), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    _evidence_ids = Column("evidence_ids", Text, default="[]", nullable=False)
    
    old_claim = Column(Text, nullable=False)
    new_claim = Column(Text, nullable=False)
    recommended_update = Column(Text, nullable=False)
    business_impact = Column(Text, nullable=False)
    owner = Column(String(255), nullable=False, index=True)
    status = Column(String(32), default="open", nullable=False, index=True)  # open, approved, rejected, resolved

    # Layer 2 Intelligence metrics
    detected_by = Column(String(128), default="agent-engineering", nullable=False, index=True)
    contradiction_score = Column(Float, default=0.85, nullable=False)
    freshness_delta = Column(Float, default=0.4, nullable=False)
    authority_delta = Column(Float, default=0.05, nullable=False)
    graph_hops = Column(Integer, default=1, nullable=False)
    risk_level = Column(String(32), default="MEDIUM", nullable=False)  # HIGH, MEDIUM, LOW

    # Layer 0 Policy & Approval Matrix (JSON)
    _approval_matrix = Column("approval_matrix", Text, default="{}", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    organization = relationship("Organization", back_populates="conflicts")
    document = relationship("Document", back_populates="conflicts")

    __table_args__ = (
        Index("ix_conflicts_org_status", "organization_id", "status"),
        Index("ix_conflicts_org_domain", "organization_id", "domain"),
    )

    @property
    def evidence_ids(self) -> list[str]:
        try:
            return json.loads(self._evidence_ids)
        except Exception:
            return []

    @evidence_ids.setter
    def evidence_ids(self, value: list[str]) -> None:
        self._evidence_ids = json.dumps(value)

    @property
    def approval_matrix(self) -> dict:
        try:
            return json.loads(self._approval_matrix)
        except Exception:
            return {}

    @approval_matrix.setter
    def approval_matrix(self, value: dict) -> None:
        self._approval_matrix = json.dumps(value)
