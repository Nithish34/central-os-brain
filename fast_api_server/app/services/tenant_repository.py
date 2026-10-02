import uuid
from typing import Type, TypeVar, List, Optional, Any, Dict
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.audit import AuditLog

T = TypeVar("T")


class TenantScopedRepository:
    """
    Repository wrapper enforcing strict tenant isolation across all DB operations.
    Any query or modification is automatically scoped to self.organization_id.
    """
    def __init__(self, db: Session, organization_id: str, actor_id: Optional[str] = None, actor_name: Optional[str] = None):
        if not organization_id:
            raise ValueError("TenantScopedRepository requires a valid organization_id")
        self.db = db
        self.organization_id = organization_id
        self.actor_id = actor_id
        self.actor_name = actor_name or "System"

    def query(self, model: Type[T]) -> Any:
        q = self.db.query(model)
        if hasattr(model, "organization_id"):
            q = q.filter(model.organization_id == self.organization_id)
        return q

    def get(self, model: Type[T], entity_id: str) -> Optional[T]:
        if hasattr(model, "organization_id"):
            return self.db.query(model).filter(
                model.id == entity_id,
                model.organization_id == self.organization_id
            ).first()
        return self.db.query(model).filter(model.id == entity_id).first()

    def get_all(self, model: Type[T], limit: int = 100, offset: int = 0) -> List[T]:
        return self.query(model).offset(offset).limit(limit).all()

    def add(self, instance: Any) -> Any:
        if hasattr(instance, "organization_id"):
            # Enforce that instance belongs to this tenant
            setattr(instance, "organization_id", self.organization_id)
        self.db.add(instance)
        return instance

    def delete(self, instance: Any) -> None:
        if hasattr(instance, "organization_id") and getattr(instance, "organization_id") != self.organization_id:
            raise PermissionError(f"Cross-tenant deletion forbidden for organization {self.organization_id}")
        self.db.delete(instance)

    def commit(self) -> None:
        self.db.commit()

    def rollback(self) -> None:
        self.db.rollback()

    def flush(self) -> None:
        self.db.flush()

    def refresh(self, instance: Any) -> None:
        self.db.refresh(instance)

    def log_audit(
        self,
        action: str,
        title: str,
        target: str = "",
        reason: str = "",
        details: Optional[Dict[str, Any]] = None,
        risk_level: str = "LOW",
        layer: str = "Security & Audit",
    ) -> AuditLog:
        import json
        audit = AuditLog(
            id=f"aud-{uuid.uuid4().hex[:12]}",
            organization_id=self.organization_id,
            actor_id=self.actor_id,
            actor=self.actor_name,
            action=action,
            target=target,
            title=title,
            reason=reason,
            details_json=json.dumps(details or {}),
            evidence_count=0,
            detected_by=self.actor_name,
            risk_level=risk_level,
            layer=layer,
        )
        self.db.add(audit)
        self.db.commit()
        return audit
