import abc
import logging
import uuid
from typing import Optional, List
from sqlalchemy.orm import Session

from app.events.schemas import CanonicalEvent, StreamEventEnvelope
from app.events.bus import RedisEventBus, event_bus
from app.events.processing import EventProcessingManager
from app.events.retry import RetryService

logger = logging.getLogger(__name__)


class BaseWorker(abc.ABC):
    """
    Abstract Base Worker Runtime for Company Brain OS.
    Enforces the invariant: READ → VALIDATE → IDEMPOTENCY CHECK (RUN) → PROCESS → PERSIST → LATE ACK.
    """

    def __init__(
        self,
        consumer_group: str,
        worker_id: Optional[str] = None,
        bus: Optional[RedisEventBus] = None,
    ):
        self.consumer_group = consumer_group
        self.worker_id = worker_id or f"{consumer_group}-{uuid.uuid4().hex[:6]}"
        self.bus = bus or event_bus

    @abc.abstractmethod
    def process_event(self, event: CanonicalEvent, run_id: str, db: Session) -> None:
        """
        Subclass business logic. Must perform idempotent operations against the DB.
        """
        pass

    def handle_message(self, envelope: StreamEventEnvelope, db: Session) -> bool:
        """
        Executes complete worker lifecycle for a single message envelope.
        Returns True if message was successfully processed or skipped due to idempotency.
        """
        event = envelope.canonical_event
        run_id = envelope.run_id
        run_type = "REPLAY" if "replay" in run_id.lower() else "LIVE"

        # 1. Idempotency Check / Claim per (event_id, consumer_group, run_id)
        state, should_process = EventProcessingManager.claim_or_check_idempotency(
            db=db,
            event_id=event.event_id,
            organization_id=event.organization_id,
            consumer_group=self.consumer_group,
            run_id=run_id,
            run_type=run_type,
            worker_id=self.worker_id,
        )

        if not should_process:
            logger.info(
                f"[{self.consumer_group}] Event {event.event_id} already COMPLETED for run {run_id}. Late ACK dispatched."
            )
            self.bus.ack(self.consumer_group, envelope.stream_id)
            return True

        # 2. Business Execution
        try:
            self.process_event(event=event, run_id=run_id, db=db)

            # 3. Mark DB State Completed
            EventProcessingManager.mark_completed(db, state)

            # 4. Late ACK ONLY after successful DB state persistence
            self.bus.ack(self.consumer_group, envelope.stream_id)
            logger.info(
                f"[{self.consumer_group}] Successfully processed and ACKed event {event.event_id} (run={run_id})"
            )
            return True

        except Exception as e:
            logger.error(
                f"[{self.consumer_group}] Error processing event {event.event_id}: {e}",
                exc_info=True,
            )
            is_perm = RetryService.is_permanent_error(e)
            routed_to_dlq = EventProcessingManager.handle_failure(
                db=db,
                state=state,
                event=event,
                error=e,
                is_permanent=is_perm,
            )

            # If routed to DLQ, ACK from Redis Stream to prevent infinite poison-pill loops in PEL
            if routed_to_dlq:
                self.bus.ack(self.consumer_group, envelope.stream_id)

            return False

    def poll_and_process_batch(self, db: Session, count: int = 10) -> int:
        """
        Fetches a batch of unacknowledged events from the stream and executes them.
        Returns count of processed messages.
        """
        envelopes = self.bus.read_group(
            group_name=self.consumer_group,
            consumer_name=self.worker_id,
            count=count,
            block_ms=500,
        )

        processed_count = 0
        for env in envelopes:
            if self.handle_message(env, db):
                processed_count += 1

        return processed_count
