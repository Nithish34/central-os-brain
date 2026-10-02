import logging
from typing import Optional
from sqlalchemy.orm import Session

from app.events.schemas import CanonicalEvent
from app.workers.base import BaseWorker
from app.services.tenant_repository import TenantScopedRepository

logger = logging.getLogger(__name__)


class AuditWorker(BaseWorker):
    """
    Audit Worker for the 'audit-workers' consumer group.
    Durably records an immutable audit log entry for every received event.
    """

    def __init__(self, worker_id: Optional[str] = None):
        super().__init__(consumer_group="audit-workers", worker_id=worker_id)

    def process_event(self, event: CanonicalEvent, run_id: str, db: Session) -> None:
        repo = TenantScopedRepository(
            db=db,
            organization_id=event.organization_id,
            actor_id=event.actor.internal_user_id or event.actor.id or "system-event-bus",
            actor_name=event.actor.name or f"{event.provider} Event",
        )

        repo.log_audit(
            action=f"event.{event.provider}.received",
            title=f"Canonical Event [{event.event_type}] processed",
            target=event.event_id,
            reason=f"Event ingested from {event.provider} (run={run_id})",
            risk_level="LOW",
        )
        logger.info(f"[AuditWorker] Recorded audit trail for event {event.event_id} (run={run_id})")
