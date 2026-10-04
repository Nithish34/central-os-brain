from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


from typing import Any

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

    id: Any = Column(String(64), primary_key=True, index=True)
    organization_id: Any = Column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    email: Any = Column(String(255), nullable=False, index=True)
    hashed_password: Any = Column(String(255), nullable=True)
    full_name: Any = Column(String(255), default="", nullable=False)
    avatar_url: Any = Column(String(512), nullable=True)
    role: Any = Column(String(32), default=UserRole.EMPLOYEE.value, nullable=False, index=True)
    auth_provider: Any = Column(String(32), default="local", nullable=False)  # local, google, microsoft
    auth_provider_id: Any = Column(String(255), nullable=True)
    is_active: Any = Column(Boolean, default=True, nullable=False)
    created_at: Any = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at: Any = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    organization = relationship("Organization", back_populates="users")

    __table_args__ = (
        Index("ix_users_org_email", "organization_id", "email", unique=True),
    )
