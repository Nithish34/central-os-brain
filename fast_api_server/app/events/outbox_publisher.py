import logging
import json
import time
from datetime import datetime, timezone
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.models.event_outbox import EventOutbox
from app.events.schemas import CanonicalEvent
from app.events.bus import RedisEventBus, event_bus

logger = logging.getLogger(__name__)


def utcnow():
    return datetime.now(timezone.utc)


class OutboxPublisher:
    """
    Transactional Outbox Publisher.
    Reliably dispatches pending canonical events from PostgreSQL to Redis Streams.
    Uses SELECT ... FOR UPDATE SKIP LOCKED to prevent duplicate publishing across instances.
    """

    def __init__(self, bus: Optional[RedisEventBus] = None):
        self.bus = bus or event_bus
        self._running = False

    def publish_pending_batch(
        self,
        db: Session,
        batch_size: int = 50,
        worker_id: str = "outbox-publisher-1",
    ) -> int:
        """
        Claims and publishes a single batch of pending outbox events.
        Returns the count of successfully published events.
        """
        # Attempt row-level locking with SKIP LOCKED. Fall back cleanly if dialect is SQLite during unit tests.
        dialect = db.bind.dialect.name if db.bind else ""
        query = db.query(EventOutbox).filter(
            EventOutbox.status.in_(["PENDING", "FAILED"]),
            EventOutbox.attempts < 5,
        ).order_by(EventOutbox.created_at.asc()).limit(batch_size)

        if dialect == "postgresql":
            outbox_entries = query.with_for_update(skip_locked=True).all()
        else:
            outbox_entries = query.all()

        if not outbox_entries:
            return 0

        claimed_count = len(outbox_entries)
        logger.info(f"[OutboxPublisher] Worker {worker_id} claimed {claimed_count} outbox entries.")

        success_count = 0
        for entry in outbox_entries:
            entry.claimed_at = utcnow()
            entry.claimed_by = worker_id
            entry.status = "CLAIMED"
            entry.attempts += 1

            try:
                payload_dict = json.loads(entry.payload_json)
                canonical = CanonicalEvent(**payload_dict)

                # Publish to Redis Stream
                stream_id = self.bus.publish(
                    event=canonical,
                    outbox_id=entry.id,
                    run_id=entry.run_id,
                    stream_name=entry.topic,
                )

                entry.status = "PUBLISHED"
                entry.published_at = utcnow()
                entry.last_error = None
                success_count += 1
                logger.debug(f"[OutboxPublisher] Published outbox={entry.id} (event={entry.event_id}) -> stream_id={stream_id}")

            except Exception as e:
                entry.status = "FAILED"
                entry.last_error = f"Publish failed: {str(e)}"
                logger.error(f"[OutboxPublisher] Failed publishing outbox {entry.id}: {e}", exc_info=True)

        try:
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"[OutboxPublisher] Failed to commit outbox batch status: {e}", exc_info=True)
            return 0

        return success_count

    def run_once(self, db: Session, batch_size: int = 50) -> int:
        return self.publish_pending_batch(db, batch_size=batch_size)


outbox_publisher = OutboxPublisher()
