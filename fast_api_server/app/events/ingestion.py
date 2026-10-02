import logging
import json
from typing import Tuple, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models.canonical_event import CanonicalEventModel
from app.models.event_outbox import EventOutbox
from app.events.schemas import CanonicalEvent
from app.events.factory import generate_outbox_id
from app.events.normalizers.registry import NormalizerRegistry

logger = logging.getLogger(__name__)


class EventIngestionService:
    @staticmethod
    def ingest_event(
        db: Session,
        event: CanonicalEvent,
        run_id: str = "run_live_001",
        topic: str = "company_brain:events",
    ) -> Tuple[CanonicalEventModel, bool, Optional[EventOutbox]]:
        """
        Durable, transactional ingestion of canonical event.
        Guarantees:
        1. Authoritative idempotency check via PostgreSQL unique constraint (organization_id, idempotency_key).
        2. Atomic creation of CanonicalEventModel and EventOutbox in a single transaction.
        3. Returns (record, is_new, outbox_entry).
        """
        # Fast-path idempotency check in DB
        existing = db.query(CanonicalEventModel).filter(
            CanonicalEventModel.organization_id == event.organization_id,
            CanonicalEventModel.idempotency_key == event.idempotency_key,
        ).first()

        if existing:
            logger.info(
                f"[Ingestion] Duplicate event skipped for org={event.organization_id}, "
                f"idempotency_key={event.idempotency_key}, existing_id={existing.id}"
            )
            return existing, False, None

        record = CanonicalEventModel(
            id=event.event_id,
            organization_id=event.organization_id,
            provider=event.provider,
            event_type=event.event_type,
            external_event_id=event.external_event_id,
            external_account_id=event.external_account_id,
            idempotency_key=event.idempotency_key,
            _actor=json.dumps(event.actor.model_dump()),
            _source=json.dumps(event.source.model_dump()),
            _payload=json.dumps(event.payload),
            _metadata=json.dumps(event.metadata),
            correlation_id=event.correlation_id,
            causation_id=event.causation_id,
            schema_version=event.schema_version,
            occurred_at=event.occurred_at,
            received_at=event.received_at,
        )

        outbox_id = generate_outbox_id()
        outbox = EventOutbox(
            id=outbox_id,
            organization_id=event.organization_id,
            event_id=record.id,
            run_id=run_id,
            topic=topic,
            payload_json=event.model_dump_json(),
            status="PENDING",
            attempts=0,
        )

        try:
            db.add(record)
            db.add(outbox)
            db.commit()
            db.refresh(record)
            logger.info(f"[Ingestion] Event {record.id} and outbox {outbox.id} durably committed for org={event.organization_id}")
            return record, True, outbox
        except IntegrityError as e:
            db.rollback()
            # Concurrent race caught by DB UniqueConstraint("organization_id", "idempotency_key")
            existing = db.query(CanonicalEventModel).filter(
                CanonicalEventModel.organization_id == event.organization_id,
                CanonicalEventModel.idempotency_key == event.idempotency_key,
            ).first()
            if existing:
                logger.info(f"[Ingestion] Concurrent duplicate caught by constraint for org={event.organization_id}")
                return existing, False, None
            raise e

    @classmethod
    def normalize_and_ingest(
        cls,
        db: Session,
        provider: str,
        payload: Dict[str, Any],
        organization_id: str,
        raw_headers: Optional[Dict[str, str]] = None,
        run_id: str = "run_live_001",
    ) -> Tuple[CanonicalEvent, CanonicalEventModel, bool, Optional[EventOutbox]]:
        """
        Normalizes inbound raw payload to CanonicalEvent and executes transactional ingestion.
        """
        normalizer = NormalizerRegistry.get(provider)
        if not normalizer:
            raise ValueError(f"No normalizer registered for provider: {provider}")

        canonical = normalizer.normalize(
            payload=payload,
            organization_id=organization_id,
            headers=raw_headers,
        )

        record, is_new, outbox = cls.ingest_event(db, canonical, run_id=run_id)
        return canonical, record, is_new, outbox
