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
    dedup_hash = Column(String(64), unique=True, index=True, nullable=True)  # sha256(min(id1, id2) + ":" + max(id1, id2))

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True, default="")
    severity = Column(String(32), default="MEDIUM", nullable=False, index=True)  # LOW, MEDIUM, HIGH, CRITICAL
    status = Column(String(32), default="OPEN", nullable=False, index=True)      # OPEN, RESOLVED, DISMISSED, REMEDIATING

    # Lineage for automated remediation
    target_repo = Column(String(255), nullable=True)        # e.g., "owner/repo"
    target_file_path = Column(String(500), nullable=True)   # e.g., "README.md" or "docs/spec.md"
    recommended_diff = Column(Text, nullable=True)          # Unified git diff

    resolved_by = Column(String(64), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    domain = Column(String(128), default="Engineering", nullable=True, index=True)
    document_id = Column(String(64), ForeignKey("documents.id", ondelete="CASCADE"), nullable=True, index=True)
    _evidence_ids = Column("evidence_ids", Text, default="[]", nullable=False)

    old_claim = Column(Text, nullable=True, default="")
    new_claim = Column(Text, nullable=True, default="")
    recommended_update = Column(Text, nullable=True, default="")
    business_impact = Column(Text, nullable=True, default="")
    owner = Column(String(255), default="Engineering", nullable=True, index=True)

    # Layer 2 Intelligence metrics
    detected_by = Column(String(128), default="agent-engineering", nullable=True, index=True)
    contradiction_score = Column(Float, default=0.85, nullable=True)
    freshness_delta = Column(Float, default=0.4, nullable=True)
    authority_delta = Column(Float, default=0.05, nullable=True)
    graph_hops = Column(Integer, default=1, nullable=True)
    risk_level = Column(String(32), default="MEDIUM", nullable=True)  # HIGH, MEDIUM, LOW

    # Layer 0 Policy & Approval Matrix (JSON)
    _approval_matrix = Column("approval_matrix", Text, default="{}", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    organization = relationship("Organization", back_populates="conflicts")
    document = relationship("Document", back_populates="conflicts")
    evidences = relationship("ConflictEvidence", back_populates="conflict", cascade="all, delete-orphan")

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


class ConflictEvidence(Base):
    __tablename__ = "conflict_evidences"

    id = Column(String(64), primary_key=True)
    conflict_id = Column(String(64), ForeignKey("conflicts.id", ondelete="CASCADE"), index=True)
    event_id = Column(String(64), ForeignKey("events.id", ondelete="SET NULL"), nullable=True)

    source = Column(String(64), nullable=False)  # "Slack", "GitHub", "Notion"
    content_excerpt = Column(Text, nullable=False)
    author = Column(String(255), nullable=True)
    authority_score = Column(Float, default=0.5)
    timestamp = Column(String(64), nullable=True)

    conflict = relationship("Conflict", back_populates="evidences")

