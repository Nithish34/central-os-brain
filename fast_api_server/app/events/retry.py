import logging
import json
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Type
from sqlalchemy.orm import Session

from app.models.event_processing import EventProcessingState
from app.models.event_dead_letter import EventDeadLetter
from app.models.event_outbox import EventOutbox
from app.events.schemas import CanonicalEvent
from app.events.factory import generate_outbox_id
from app.events.types import ProcessingStatus, DeadLetterResolution

logger = logging.getLogger(__name__)

# Permanent non-retryable error classifications
PERMANENT_ERROR_TYPES = (
    ValueError,
    TypeError,
    json.JSONDecodeError,
    KeyError,
)


class RetryService:
    """Classifies errors, computes exponential backoffs, and manages retry cycles."""

    @staticmethod
    def is_permanent_error(error: Exception) -> bool:
        if isinstance(error, PERMANENT_ERROR_TYPES):
            return True
        err_str = str(error).lower()
        if "invalid" in err_str or "unsupported" in err_str or "malformed" in err_str:
            return True
        return False


class DeadLetterService:
    """Manages dead-lettered messages, inspection, and manual re-queuing."""

    @staticmethod
    def list_dead_letters(
        db: Session,
        organization_id: str,
        consumer_group: Optional[str] = None,
        resolution_status: Optional[str] = None,
        limit: int = 50,
    ) -> List[EventDeadLetter]:
        query = db.query(EventDeadLetter).filter(
            EventDeadLetter.organization_id == organization_id
        )
        if consumer_group:
            query = query.filter(EventDeadLetter.consumer_group == consumer_group)
        if resolution_status:
            query = query.filter(EventDeadLetter.resolution_status == resolution_status)
        return query.order_by(EventDeadLetter.failed_at.desc()).limit(limit).all()

    @staticmethod
    def retry_dead_letter(
        db: Session,
        dlq_id: str,
        organization_id: str,
    ) -> Optional[EventDeadLetter]:
        """
        Retries a dead-lettered event by marking DLQ resolved and re-enqueuing into outbox.
        """
        dlq_entry = db.query(EventDeadLetter).filter(
            EventDeadLetter.id == dlq_id,
            EventDeadLetter.organization_id == organization_id,
        ).first()

        if not dlq_entry:
            return None

        dlq_entry.resolution_status = DeadLetterResolution.RETRIED.value
        dlq_entry.resolved_at = datetime.now(timezone.utc)

        # Re-create outbox entry for publishing
        new_outbox = EventOutbox(
            id=generate_outbox_id(),
            organization_id=organization_id,
            event_id=dlq_entry.event_id,
            run_id=f"run_retry_{dlq_id[-8:]}",
            topic="company_brain:events",
            payload_json=dlq_entry.payload_snapshot,
            status="PENDING",
            attempts=0,
        )
        db.add(new_outbox)
        db.commit()
        db.refresh(dlq_entry)
        logger.info(f"[DLQ] Dead letter {dlq_id} marked RETRIED and re-enqueued in outbox {new_outbox.id}")
        return dlq_entry
