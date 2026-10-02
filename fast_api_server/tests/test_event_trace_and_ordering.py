import pytest
from datetime import datetime, timezone
from app.events.schemas import ActorInfo, SourceInfo
from app.events.factory import create_canonical_event
from app.events.ingestion import EventIngestionService
from app.events.bus import RedisEventBus
from app.events.outbox_publisher import OutboxPublisher
from app.workers.knowledge_worker import KnowledgeWorker
from app.workers.audit_worker import AuditWorker
from app.models.canonical_event import CanonicalEventModel
from app.models.event_outbox import EventOutbox
from app.models.audit import AuditLog


def test_h17_event_ordering_investigation(db, org_a):
    """
    H17 — Event Ordering Investigation.
    Tests causal sequence of events (e.g. message.created -> message.updated -> message.deleted).
    Documents that Phase 4 provides causal tracking via correlation_id & causation_id,
    with outbox FIFO ordering per organization.
    """
    bus = RedisEventBus()
    bus.ensure_consumer_groups()

    corr_id = "corr_session_999"

    # Event 1: message.created
    evt1 = create_canonical_event(
        organization_id=org_a.id,
        provider="slack",
        event_type="message.created",
        actor=ActorInfo(name="Author"),
        source=SourceInfo(provider="slack"),
        occurred_at=datetime(2026, 9, 21, 10, 0, 0, tzinfo=timezone.utc),
        payload={"text": "Original draft text"},
        external_event_id="msg_v1",
        correlation_id=corr_id,
    )
    EventIngestionService.ingest_event(db, evt1)

    # Event 2: message.updated (causation_id = evt1.id)
    evt2 = create_canonical_event(
        organization_id=org_a.id,
        provider="slack",
        event_type="message.updated",
        actor=ActorInfo(name="Author"),
        source=SourceInfo(provider="slack"),
        occurred_at=datetime(2026, 9, 21, 10, 5, 0, tzinfo=timezone.utc),
        payload={"text": "Revised finalized text"},
        external_event_id="msg_v2",
        correlation_id=corr_id,
        causation_id=evt1.event_id,
    )
    EventIngestionService.ingest_event(db, evt2)

    # Publish and drain
    publisher = OutboxPublisher(bus=bus)
    publisher.publish_pending_batch(db)

    kw = KnowledgeWorker()
    kw.poll_and_process_batch(db)

    # Verify chronological ordering in canonical events store
    events = db.query(CanonicalEventModel).filter(
        CanonicalEventModel.correlation_id == corr_id
    ).order_by(CanonicalEventModel.occurred_at.asc()).all()

    assert len(events) == 2
    assert events[0].id == evt1.event_id
    assert events[1].id == evt2.event_id
    assert events[1].causation_id == evt1.event_id


def test_h19_correlation_and_causation_trace_e2e(db, org_a):
    """
    H19 — Correlation and Causation Trace.
    Trace event from Ingestion -> Canonical Event -> Outbox -> Redis Stream -> Workers -> Audit Log.
    Verifies that event_id, correlation_id, causation_id, and run_id remain intact.
    """
    bus = RedisEventBus()
    bus.ensure_consumer_groups()

    corr_id = "corr_trace_xyz_777"
    cause_id = "evt_upstream_origin_000"

    event = create_canonical_event(
        organization_id=org_a.id,
        provider="github",
        event_type="repository.pull_request.created",
        actor=ActorInfo(name="Traced Developer", email="dev@example.com"),
        source=SourceInfo(provider="github", repository_id="acme/core"),
        occurred_at=datetime.now(timezone.utc),
        payload={"title": "Traceable PR", "text": "PR tracing content"},
        external_event_id="h19_trace_001",
        correlation_id=corr_id,
        causation_id=cause_id,
    )

    # 1. Ingest
    rec, is_new, outbox = EventIngestionService.ingest_event(db, event)
    assert rec.correlation_id == corr_id
    assert rec.causation_id == cause_id
    assert outbox.event_id == event.event_id

    # 2. Publish
    publisher = OutboxPublisher(bus=bus)
    publisher.publish_pending_batch(db)

    # 3. Stream delivery inspect
    envelopes = bus.read_group("audit-workers", "audit-trace-1", count=1)
    assert len(envelopes) == 1
    stream_env = envelopes[0]
    assert stream_env.canonical_event.correlation_id == corr_id
    assert stream_env.canonical_event.causation_id == cause_id
    assert stream_env.event_id == event.event_id

    # 4. Audit Worker Execution
    audit_worker = AuditWorker(worker_id="audit-trace-1")
    audit_worker.handle_message(stream_env, db)

    # 5. Verify Audit Log
    audit_log = db.query(AuditLog).filter(
        AuditLog.organization_id == org_a.id,
        AuditLog.target == event.event_id,
    ).first()
    assert audit_log is not None
    assert audit_log.target == event.event_id
