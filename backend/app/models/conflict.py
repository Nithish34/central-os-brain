import json
from sqlalchemy import Column, String, Float, Integer, Text, ForeignKey
from app.core.database import Base


class Conflict(Base):
    __tablename__ = "conflicts"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    severity = Column(String, default="medium", index=True)  # critical, high, medium, low
    domain = Column(String, nullable=False, index=True)
    document_id = Column(String, ForeignKey("documents.id"), nullable=False, index=True)
    _evidence_ids = Column("evidence_ids", Text, default="[]")
    
    old_claim = Column(Text, nullable=False)
    new_claim = Column(Text, nullable=False)
    recommended_update = Column(Text, nullable=False)
    business_impact = Column(Text, nullable=False)
    owner = Column(String, nullable=False, index=True)
    status = Column(String, default="open", index=True)  # open, approved, rejected, resolved

    # Layer 2 Intelligence metrics
    detected_by = Column(String, default="agent-engineering", index=True)
    contradiction_score = Column(Float, default=0.85)
    freshness_delta = Column(Float, default=0.4)
    authority_delta = Column(Float, default=0.05)
    graph_hops = Column(Integer, default=1)
    risk_level = Column(String, default="MEDIUM")  # HIGH, MEDIUM, LOW

    # Layer 0 Policy & Approval Matrix (JSON)
    _approval_matrix = Column("approval_matrix", Text, default="{}")

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
