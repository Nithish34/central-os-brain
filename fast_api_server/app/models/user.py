from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class UserRole(str, Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MANAGER = "manager"
    EMPLOYEE = "employee"
    AGENT = "agent"


class User(Base):
    __tablename__ = "users"

    id = Column(String(64), primary_key=True, index=True)
    organization_id = Column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    hashed_password = Column(String(255), nullable=True)
    full_name = Column(String(255), default="", nullable=False)
    avatar_url = Column(String(512), nullable=True)
    role = Column(String(32), default=UserRole.EMPLOYEE.value, nullable=False, index=True)
    auth_provider = Column(String(32), default="local", nullable=False)  # local, google, microsoft
    auth_provider_id = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    organization = relationship("Organization", back_populates="users")

    __table_args__ = (
        Index("ix_users_org_email", "organization_id", "email", unique=True),
    )
