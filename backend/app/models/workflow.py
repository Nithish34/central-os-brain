from sqlalchemy import Column, String, Text
from app.core.database import Base


class WorkflowAction(Base):
    __tablename__ = "workflow_actions"

    id = Column(String, primary_key=True, index=True)
    conflict_id = Column(String, nullable=False, index=True)
    layer = Column(String, default="Layer 0 — Execution")
    tool = Column(String, nullable=False)  # Risk & Policy Engine, Knowledge Base, Jira, Slack, GitHub
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    status = Column(String, default="completed")  # completed, in_progress, pending
    created_at = Column(String, nullable=False)
