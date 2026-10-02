import pytest
from datetime import datetime, timezone
from app.events.schemas import ActorInfo, SourceInfo, StreamEventEnvelope
from app.events.factory import create_canonical_event
from app.events.ingestion import EventIngestionService
from app.events.bus import RedisEventBus
from app.events.outbox_publisher import OutboxPublisher
from app.events.processing import EventProcessingManager
from app.workers.knowledge_worker import KnowledgeWorker
from app.models.document import Document, DocumentChunk
from app.models.event_processing import EventProcessingState


def test_h3_worker_crash_after_db_commit_before_xack(db, org_a):
    """
    H3 — Worker Crash After PostgreSQL Commit But Before XACK.
    Simulate:
    1. Worker receives message from stream.
    2. Business processing + DB commit succeed (status = COMPLETED, Document/Chunks persisted).
    3. Worker crashes BEFORE calling XACK.
    4. Unacked message is reclaimed via stream redelivery / XAUTOCLAIM.
    5. Recovered worker checks idempotency -> skips business execution -> Late ACKs immediately.
    6. Verify: Zero duplicate business artifacts in DB.
    """
    bus = RedisEventBus()
    bus.ensure_consumer_groups()

    event = create_canonical_event(
        organization_id=org_a.id,
        provider="slack",
        event_type="message.created",
        actor=ActorInfo(name="Crash Test User"),
        source=SourceInfo(provider="slack"),
        occurred_at=datetime.now(timezone.utc),
        payload={"text": "Message to test crash after commit before XACK."},
        external_event_id="h3_crash_msg_001",
    )
    rec, is_new, outbox = EventIngestionService.ingest_event(db, event)

    publisher = OutboxPublisher(bus=bus)
    publisher.publish_pending_batch(db)

    # 1. Read message as Worker 1
    envelopes = bus.read_group("knowledge-workers", "worker-1", count=1)
    assert len(envelopes) == 1
    env = envelopes[0]

    # 2. Worker 1 executes business processing and commits DB
    kw1 = KnowledgeWorker(worker_id="worker-1")
    kw1.process_event(event=env.canonical_event, run_id=env.run_id, db=db)

    state, _ = EventProcessingManager.claim_or_check_idempotency(
        db=db,
        event_id=env.event_id,
        organization_id=org_a.id,
        consumer_group="knowledge-workers",
        run_id=env.run_id,
        worker_id="worker-1",
    )
    EventProcessingManager.mark_completed(db, state)

    # Verify initial artifacts
    doc = db.query(Document).filter(Document.id == f"doc_{event.event_id}").first()
    assert doc is not None
    initial_chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).all()
    initial_count = len(initial_chunks)

    # 3. Simulated crash! Worker 1 terminates WITHOUT calling bus.ack(...)

    # 4. Worker 2 (recovering worker) receives the unacked redelivery of the same message envelope
    kw2 = KnowledgeWorker(worker_id="worker-2-recovered")
    handled = kw2.handle_message(env, db)
    assert handled is True

    # 5. Verify: Business logic was skipped due to COMPLETED state and NO duplicate chunks created
    post_recovery_chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).all()
    assert len(post_recovery_chunks) == initial_count, "No duplicate chunks must be created upon redelivery!"

    doc_count = db.query(Document).filter(Document.id == f"doc_{event.event_id}").count()
    assert doc_count == 1


def test_h4_worker_crash_before_db_commit(db, org_a):
    """
    H4 — Worker Crash Before PostgreSQL Commit.
    Simulate:
    1. Worker receives message and begins processing.
    2. Crash occurs before DB commit -> transaction rolls back.
    3. Message reclaimed.
    4. Recovered worker processes successfully and ACKs.
    """
    bus = RedisEventBus()
    bus.ensure_consumer_groups()

    event = create_canonical_event(
        organization_id=org_a.id,
        provider="github",
        event_type="repository.pull_request.created",
        actor=ActorInfo(name="Crash Test User"),
        source=SourceInfo(provider="github", repository_id="acme/api"),
        occurred_at=datetime.now(timezone.utc),
        payload={"title": "Feature X", "text": "PR payload undergoing pre-commit crash."},
        external_event_id="h4_precommit_crash_001",
    )
    EventIngestionService.ingest_event(db, event)

    publisher = OutboxPublisher(bus=bus)
    publisher.publish_pending_batch(db)

    # 1. Read message
    envelopes = bus.read_group("knowledge-workers", "worker-1", count=1)
    assert len(envelopes) == 1
    env = envelopes[0]

    # 2. Simulate worker crash before commit (explicit rollback)
    db.rollback()

    # Verify no document persisted yet
    doc_before = db.query(Document).filter(Document.id == f"doc_{event.event_id}").first()
    assert doc_before is None

    # 3. Recovered worker processes the message
    kw_recovered = KnowledgeWorker(worker_id="worker-recovered")
    success = kw_recovered.handle_message(env, db)
    assert success is True

    # 4. Verify document successfully persisted after recovery
    doc_after = db.query(Document).filter(Document.id == f"doc_{event.event_id}").first()
    assert doc_after is not None
    chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_after.id).all()
    assert len(chunks) > 0
