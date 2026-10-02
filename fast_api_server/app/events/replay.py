import json
import logging
import uuid
import time
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.models.canonical_event import CanonicalEventModel
from app.models.event_outbox import EventOutbox
from app.events.schemas import CanonicalEvent, ActorInfo, SourceInfo
from app.events.factory import generate_outbox_id
from app.services.tenant_repository import TenantScopedRepository

logger = logging.getLogger(__name__)


class EventReplayService:
    """
    Run-Identity Replay Engine.
    Enables safe, auditable re-processing of historical canonical events by assigning a unique run_id.
    """

    @staticmethod
    def generate_replay_run_id() -> str:
        ts = int(time.time())
        rand_suffix = uuid.uuid4().hex[:6]
        return f"run_replay_{ts}_{rand_suffix}"

    @classmethod
    def trigger_replay(
        cls,
        db: Session,
        organization_id: str,
        requested_by: str,
        reason: str,
        provider: Optional[str] = None,
        event_type: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 1000,
    ) -> Dict[str, Any]:
        """
        Creates new Outbox entries for matching canonical events with a fresh run_id.
        """
        run_id = cls.generate_replay_run_id()

        query = db.query(CanonicalEventModel).filter(
            CanonicalEventModel.organization_id == organization_id
        )
        if provider:
            query = query.filter(CanonicalEventModel.provider == provider.lower())
        if event_type:
            query = query.filter(CanonicalEventModel.event_type == event_type)
        if start_date:
            query = query.filter(CanonicalEventModel.occurred_at >= start_date)
        if end_date:
            query = query.filter(CanonicalEventModel.occurred_at <= end_date)

        events: List[CanonicalEventModel] = query.order_by(CanonicalEventModel.occurred_at.asc()).limit(limit).all()

        if not events:
            return {
                "run_id": run_id,
                "events_replayed_count": 0,
                "status": "completed",
                "message": "No matching events found for replay criteria.",
                "reason": reason,
                "requested_by": requested_by,
            }

        replayed_count = 0
        for evt in events:
            canonical = CanonicalEvent(
                event_id=evt.id,
                organization_id=evt.organization_id,
                provider=evt.provider,
                event_type=evt.event_type,
                external_event_id=evt.external_event_id,
                external_account_id=evt.external_account_id,
                actor=ActorInfo(**evt.actor),
                source=SourceInfo(**evt.source),
                occurred_at=evt.occurred_at,
                received_at=evt.received_at,
                payload=evt.payload,
                correlation_id=evt.correlation_id,
                causation_id=evt.causation_id,
                idempotency_key=evt.idempotency_key,
                schema_version=evt.schema_version,
                metadata={**evt.metadata_dict, "replay_reason": reason, "replay_requested_by": requested_by},
            )

            outbox = EventOutbox(
                id=generate_outbox_id(),
                organization_id=organization_id,
                event_id=evt.id,
                run_id=run_id,
                topic="company_brain:events",
                payload_json=canonical.model_dump_json(),
                status="PENDING",
                attempts=0,
            )
            db.add(outbox)
            replayed_count += 1

        # Audit log the replay run
        repo = TenantScopedRepository(db, organization_id, requested_by, "Replay Service")
        repo.log_audit(
            action="event.replay.triggered",
            title=f"Replay run {run_id} initiated ({replayed_count} events)",
            target=run_id,
            reason=reason,
            risk_level="HIGH",
        )

        db.commit()
        logger.info(
            f"[ReplayService] Created {replayed_count} replay outbox entries for org={organization_id} under run_id={run_id}"
        )

        return {
            "run_id": run_id,
            "events_replayed_count": replayed_count,
            "status": "queued",
            "reason": reason,
            "requested_by": requested_by,
        }
