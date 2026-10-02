from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class WorkflowAction(Base):
    __tablename__ = "workflow_actions"

    id = Column(String(64), primary_key=True, index=True)
    organization_id = Column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    conflict_id = Column(String(64), ForeignKey("conflicts.id", ondelete="CASCADE"), nullable=True, index=True)
    layer = Column(String(128), default="Layer 0 — Execution", nullable=False)
    tool = Column(String(128), nullable=False)  # Risk & Policy Engine, Knowledge Base, Jira, Slack, GitHub
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String(32), default="completed", nullable=False)  # completed, in_progress, pending
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    organization = relationship("Organization", back_populates="workflows")
