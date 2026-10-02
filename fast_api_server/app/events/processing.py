import logging
import json
import random
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.event_processing import EventProcessingState
from app.models.event_dead_letter import EventDeadLetter
from app.events.schemas import CanonicalEvent
from app.events.types import ProcessingStatus, RunType

logger = logging.getLogger(__name__)


def utcnow():
    return datetime.now(timezone.utc)


class EventProcessingManager:
    """
    Manages consumer-group event lifecycle, per-run idempotency, retry backoff, and dead-letter routing.
    """

    @staticmethod
    def claim_or_check_idempotency(
        db: Session,
        event_id: str,
        organization_id: str,
        consumer_group: str,
        run_id: str = "run_live_001",
        run_type: str = "LIVE",
        worker_id: str = "worker-1",
    ) -> Tuple[EventProcessingState, bool]:
        """
        Idempotently claims or retrieves processing state for (event_id, consumer_group, run_id).
        Returns (state, should_process).
        If status is already COMPLETED for this exact run_id, returns (state, False).
        """
        state = db.query(EventProcessingState).filter(
            EventProcessingState.event_id == event_id,
            EventProcessingState.consumer_group == consumer_group,
            EventProcessingState.run_id == run_id,
        ).first()

        if state:
            if state.status == ProcessingStatus.COMPLETED.value:
                logger.info(
                    f"[{consumer_group}] Event {event_id} already COMPLETED for run {run_id}. Skipping."
                )
                return state, False

            # Existing state retry attempt
            state.attempt_count += 1
            state.last_attempt_at = utcnow()
            state.worker_id = worker_id
            state.status = ProcessingStatus.PROCESSING.value
            db.commit()
            return state, True

        # First attempt for this run_id
        proc_id = f"proc_{uuid.uuid4().hex[:12]}"
        new_state = EventProcessingState(
            id=proc_id,
            organization_id=organization_id,
            event_id=event_id,
            consumer_group=consumer_group,
            run_id=run_id,
            run_type=run_type,
            status=ProcessingStatus.PROCESSING.value,
            attempt_count=1,
            worker_id=worker_id,
            first_attempt_at=utcnow(),
            last_attempt_at=utcnow(),
        )

        try:
            db.add(new_state)
            db.commit()
            db.refresh(new_state)
            return new_state, True
        except IntegrityError:
            db.rollback()
            state = db.query(EventProcessingState).filter(
                EventProcessingState.event_id == event_id,
                EventProcessingState.consumer_group == consumer_group,
                EventProcessingState.run_id == run_id,
            ).first()
            if state and state.status == ProcessingStatus.COMPLETED.value:
                return state, False
            return state, True

    @staticmethod
    def mark_completed(db: Session, state: EventProcessingState) -> None:
        state.status = ProcessingStatus.COMPLETED.value
        state.processed_at = utcnow()
        state.last_error = None
        state.error_code = None
        state.next_retry_at = None
        db.commit()

    @staticmethod
    def handle_failure(
        db: Session,
        state: Optional[EventProcessingState],
        event: CanonicalEvent,
        error: Exception,
        is_permanent: bool = False,
        max_attempts: int = 5,
    ) -> bool:
        """
        Handles worker failure.
        If attempts < max_attempts and not permanent -> schedules retry with exponential backoff.
        If attempts >= max_attempts or permanent -> writes to event_dead_letters and marks DEAD_LETTER.
        Returns True if routed to DLQ, False if scheduled for retry.
        """
        error_msg = str(error)
        if state is not None:
            state.last_error = error_msg
            state.last_attempt_at = utcnow()
            org_id = state.organization_id
            event_id = state.event_id
            consumer_group = state.consumer_group
            run_id = state.run_id
            attempts = state.attempt_count
        else:
            org_id = event.organization_id
            event_id = event.event_id
            consumer_group = "knowledge-workers"
            run_id = "run_live_001"
            attempts = 1

        if state is not None and not is_permanent and attempts < max_attempts:
            # Exponential backoff: 2^attempts + jitter (0..2s)
            base_backoff = min(300, 2 ** attempts)
            jitter = random.uniform(0.5, 2.0)
            backoff_sec = int(base_backoff + jitter)
            state.status = ProcessingStatus.FAILED.value
            state.next_retry_at = utcnow() + timedelta(seconds=backoff_sec)
            db.commit()
            logger.warning(
                f"[{consumer_group}] Event {event_id} failed attempt {attempts}/{max_attempts}. "
                f"Retry scheduled in {backoff_sec}s. Error: {error_msg}"
            )
            return False
        else:
            # Route to Dead Letter Queue
            if state is not None:
                state.status = ProcessingStatus.DEAD_LETTER.value
                state.next_retry_at = None

            dlq_id = f"dlq_{uuid.uuid4().hex[:12]}"
            dlq_record = EventDeadLetter(
                id=dlq_id,
                organization_id=org_id,
                event_id=event_id,
                consumer_group=consumer_group,
                run_id=run_id,
                failure_reason="Max retries exceeded" if not is_permanent else "Permanent failure / Poison pill",
                error_details=error_msg,
                attempts=attempts,
                payload_snapshot=event.model_dump_json(),
                failed_at=utcnow(),
                resolution_status="UNRESOLVED",
            )
            db.add(dlq_record)
            db.commit()
            logger.error(
                f"[{consumer_group}] Event {event_id} permanently failed and routed to DLQ ({dlq_id})."
            )
            return True


processing_manager = EventProcessingManager()
