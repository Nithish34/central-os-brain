from sqlalchemy import Column, String, Integer, Text
from app.core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, index=True)
    conflict_id = Column(String, nullable=False, index=True)
    actor = Column(String, default="Hackathon Demo Admin")
    action = Column(String, nullable=False)  # approved, rejected, resolved
    title = Column(String, nullable=False)
    reason = Column(Text, default="")
    timestamp = Column(String, nullable=False)
    evidence_count = Column(Integer, default=1)
    detected_by = Column(String, default="")
    risk_level = Column(String, default="")
    layer = Column(String, default="Layer 0 — Execution")
