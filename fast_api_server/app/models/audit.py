from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(64), primary_key=True, index=True)
    organization_id = Column(String(64), ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False, index=True)
    actor_id = Column(String(64), nullable=True, index=True)
    actor = Column(String(255), default="System", nullable=False)
    action = Column(String(128), nullable=False, index=True)  # login, role_change, connect_integration, etc.
    target = Column(String(255), default="", nullable=False)
    title = Column(String(255), nullable=False)
    reason = Column(Text, default="", nullable=False)
    details_json = Column(Text, default="{}", nullable=False)
    timestamp = Column(DateTime(timezone=True), default=utcnow, nullable=False, index=True)
    evidence_count = Column(Integer, default=0, nullable=False)
    detected_by = Column(String(128), default="", nullable=False)
    risk_level = Column(String(64), default="LOW", nullable=False)
    layer = Column(String(128), default="Security & Audit", nullable=False)

    organization = relationship("Organization", back_populates="audit_logs")
