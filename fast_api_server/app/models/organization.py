from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String(64), primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    domain = Column(String(255), nullable=True, index=True)
    plan = Column(String(64), default="enterprise", nullable=False)
    deactivated_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    # Relationships
    users = relationship("User", back_populates="organization", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="organization", cascade="all, delete-orphan")
    events = relationship("CompanyEvent", back_populates="organization", cascade="all, delete-orphan")
    conflicts = relationship("Conflict", back_populates="organization", cascade="all, delete-orphan")
    agents = relationship("AgentProfile", back_populates="organization", cascade="all, delete-orphan")
    integrations = relationship("IntegrationAccount", back_populates="organization", cascade="all, delete-orphan")
    workflows = relationship("WorkflowAction", back_populates="organization", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="organization")

    @property
    def is_active(self) -> bool:
        return self.deactivated_at is None
