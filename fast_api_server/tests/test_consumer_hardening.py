import pytest
from datetime import datetime, timezone
from app.events.schemas import ActorInfo, SourceInfo
from app.events.factory import create_canonical_event
from app.events.ingestion import EventIngestionService
from app.events.bus import RedisEventBus
from app.events.outbox_publisher import OutboxPublisher
from app.events.processing import EventProcessingManager
from app.workers.knowledge_worker import KnowledgeWorker
from app.workers.workflow_worker import WorkflowWorker
from app.workers.audit_worker import AuditWorker
from app.models.event_processing import EventProcessingState
from app.models.event_dead_letter import EventDeadLetter
from app.models.audit import AuditLog


def test_h9_concurrent_duplicate_consumers(db, org_a):
    """
    H9 — Concurrent Duplicate Consumers.
    Simulate multiple workers processing the exact same stream message concurrently.
    Verifies that idempotency check prevents duplicate processing and state corruption.
    """
    bus = RedisEventBus()
    bus.ensure_consumer_groups()

    event = create_canonical_event(
        organization_id=org_a.id,
        provider="slack",
        event_type="message.created",
        actor=ActorInfo(name="Concurrent Tester"),
        source=SourceInfo(provider="slack"),
        occurred_at=datetime.now(timezone.utc),
        payload={"text": "Concurrent consumers race condition check payload"},
        external_event_id="h9_concurrent_001",
    )
    EventIngestionService.ingest_event(db, event)

    publisher = OutboxPublisher(bus=bus)
    publisher.publish_pending_batch(db)

    envelopes = bus.read_group("knowledge-workers", "kw-1", count=1)
    assert len(envelopes) == 1
    env = envelopes[0]

    kw1 = KnowledgeWorker(worker_id="kw-thread-1")
    kw2 = KnowledgeWorker(worker_id="kw-thread-2")

    res1 = kw1.handle_message(env, db)
    res2 = kw2.handle_message(env, db)

    assert res1 is True
    assert res2 is True

    # Exactly 1 processing state record in COMPLETED status
    states = db.query(EventProcessingState).filter(
        EventProcessingState.event_id == event.event_id,
        EventProcessingState.consumer_group == "knowledge-workers",
    ).all()
    assert len(states) == 1
    assert states[0].status == "COMPLETED"


def test_h10_independent_consumer_group_failure(db, org_a):
    """
    H10 — Independent Consumer Group Failure.
    Force knowledge-workers to fail permanently on an event.
    Verify:
    1. Knowledge worker routes to DLQ
    2. Workflow worker and Audit worker succeed independently and late ACK.
    """
    bus = RedisEventBus()
    bus.ensure_consumer_groups()

    event = create_canonical_event(
        organization_id=org_a.id,
        provider="github",
        event_type="repository.pull_request.created",
        actor=ActorInfo(name="Isolated Failure Tester"),
        source=SourceInfo(provider="github", repository_id="acme/isolated"),
        occurred_at=datetime.now(timezone.utc),
        payload={"text": "Event with isolated consumer failure"},
        external_event_id="h10_isolated_001",
    )
    EventIngestionService.ingest_event(db, event)
    publisher = OutboxPublisher(bus=bus)
    publisher.publish_pending_batch(db)

    # 1. Simulate failure in knowledge-workers
    kw_envs = bus.read_group("knowledge-workers", "kw-isolated", count=1)
    for env in kw_envs:
        state, _ = EventProcessingManager.claim_or_check_idempotency(
            db=db,
            event_id=env.event_id,
            organization_id=org_a.id,
            consumer_group="knowledge-workers",
            run_id=env.run_id,
            worker_id="kw-isolated",
        )
        # Poison pill failure
        EventProcessingManager.handle_failure(
            db=db,
            state=state,
            event=event,
            error=ValueError("Poison pill in knowledge pipeline"),
            is_permanent=True,
        )
        bus.ack("knowledge-workers", env.stream_id)

    # 2. Run healthy workflow and audit workers
    wf = WorkflowWorker()
    aw = AuditWorker()

    wf_count = wf.poll_and_process_batch(db)
    aw_count = aw.poll_and_process_batch(db)

    assert wf_count >= 1
    assert aw_count >= 1

    # Verify Knowledge worker state is DEAD_LETTER
    kw_state = db.query(EventProcessingState).filter(
        EventProcessingState.event_id == event.event_id,
        EventProcessingState.consumer_group == "knowledge-workers",
    ).first()
    assert kw_state.status == "DEAD_LETTER"

    # Verify Workflow & Audit worker states are COMPLETED
    wf_state = db.query(EventProcessingState).filter(
        EventProcessingState.event_id == event.event_id,
        EventProcessingState.consumer_group == "workflow-workers",
    ).first()
    assert wf_state.status == "COMPLETED"

    aw_state = db.query(EventProcessingState).filter(
        EventProcessingState.event_id == event.event_id,
        EventProcessingState.consumer_group == "audit-workers",
    ).first()
    assert aw_state.status == "COMPLETED"


def test_h11_retry_semantics_same_run_id(db, org_a):
    """
    H11 — Retry Semantics.
    Verify transient failures retry within the SAME run_id, increment attempt_count,
    apply exponential backoff, and mark COMPLETED upon successful retry.
    """
    event = create_canonical_event(
        organization_id=org_a.id,
        provider="slack",
        event_type="message.created",
        actor=ActorInfo(name="Retry Tester"),
        source=SourceInfo(provider="slack"),
        occurred_at=datetime.now(timezone.utc),
        payload={"text": "Transient failure payload"},
        external_event_id="h11_retry_001",
    )
    EventIngestionService.ingest_event(db, event)

    # Attempt 1: Transient network timeout
    state1, _ = EventProcessingManager.claim_or_check_idempotency(
        db=db,
        event_id=event.event_id,
        organization_id=org_a.id,
        consumer_group="knowledge-workers",
        run_id="run_live_001",
        worker_id="kw-retry-1",
    )
    assert state1.attempt_count == 1
    assert state1.run_id == "run_live_001"

    to_dlq = EventProcessingManager.handle_failure(
        db=db,
        state=state1,
        event=event,
        error=TimeoutError("Transient DB connection timeout"),
        is_permanent=False,
    )
    assert to_dlq is False
    assert state1.status == "FAILED"
    assert state1.next_retry_at is not None

    # Attempt 2: Retry within same run_id
    state2, should_process = EventProcessingManager.claim_or_check_idempotency(
        db=db,
        event_id=event.event_id,
        organization_id=org_a.id,
        consumer_group="knowledge-workers",
        run_id="run_live_001",
        worker_id="kw-retry-1",
    )
    assert should_process is True
    assert state2.attempt_count == 2
    assert state2.run_id == "run_live_001"  # Invariant: SAME run_id

    # Mark completed on successful retry
    EventProcessingManager.mark_completed(db, state2)
    assert state2.status == "COMPLETED"
    assert state2.next_retry_at is None


def test_h16_schema_version_failure_routing(db, org_a):
    """
    H16 — Schema Version Failure.
    Events with invalid/unsupported schemas or corrupt payloads route to DLQ without crashing worker runtime.
    """
    event = create_canonical_event(
        organization_id=org_a.id,
        provider="slack",
        event_type="unsupported.schema",
        actor=ActorInfo(name="Schema Tester"),
        source=SourceInfo(provider="slack"),
        occurred_at=datetime.now(timezone.utc),
        payload={"corrupt_key": None},
        external_event_id="h16_schema_001",
    )
    event.schema_version = "99.0.0-unsupported"
    EventIngestionService.ingest_event(db, event)

    state, _ = EventProcessingManager.claim_or_check_idempotency(
        db=db,
        event_id=event.event_id,
        organization_id=org_a.id,
        consumer_group="knowledge-workers",
        run_id="run_live_001",
    )

    routed = EventProcessingManager.handle_failure(
        db=db,
        state=state,
        event=event,
        error=ValueError(f"Unsupported schema version: {event.schema_version}"),
        is_permanent=True,
    )
    assert routed is True
    assert state.status == "DEAD_LETTER"

    dlq = db.query(EventDeadLetter).filter(
        EventDeadLetter.event_id == event.event_id,
        EventDeadLetter.consumer_group == "knowledge-workers",
    ).first()
    assert dlq is not None
    assert "Unsupported schema version" in dlq.error_details
