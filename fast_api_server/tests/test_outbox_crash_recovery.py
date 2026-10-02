import pytest
from datetime import datetime, timezone
from app.events.schemas import ActorInfo, SourceInfo
from app.events.factory import create_canonical_event
from app.events.ingestion import EventIngestionService
from app.events.bus import RedisEventBus
from app.events.outbox_publisher import OutboxPublisher
from app.workers.knowledge_worker import KnowledgeWorker
from app.models.event_outbox import EventOutbox
from app.models.document import Document, DocumentChunk


def test_h1_outbox_crash_after_redis_xadd(db, org_a):
    """
    H1 — Outbox Crash After Redis XADD.
    Simulate:
    1. Outbox publisher claims row
    2. Redis XADD succeeds
    3. Process crashes before status = 'PUBLISHED' is committed
    4. Publisher recovers and republishes
    5. Verify: Duplicate transport delivery -> Idempotent consumer -> EXACTLY ONE business effect.
    """
    bus = RedisEventBus()
    bus.ensure_consumer_groups()
    knowledge_worker = KnowledgeWorker()

    # 1. Ingest event
    event = create_canonical_event(
        organization_id=org_a.id,
        provider="slack",
        event_type="message.created",
        actor=ActorInfo(name="Crash Test User"),
        source=SourceInfo(provider="slack"),
        occurred_at=datetime.now(timezone.utc),
        payload={"text": "Critical transaction payload that will undergo crash recovery."},
        external_event_id="h1_crash_event_001",
    )
    rec, is_new, outbox = EventIngestionService.ingest_event(db, event)
    assert is_new is True

    # 2. Simulate Outbox Publisher publishing to Redis Stream, but crashing before DB commit
    stream_id_1 = bus.publish(
        event=event,
        outbox_id=outbox.id,
        run_id=outbox.run_id,
    )
    assert stream_id_1 is not None

    # Verify Outbox row in DB is still PENDING because crash prevented commit of PUBLISHED state
    db_outbox = db.query(EventOutbox).filter(EventOutbox.id == outbox.id).first()
    assert db_outbox.status == "PENDING"

    # 3. Publisher restarts and publishes the pending outbox entry again (2nd transport delivery)
    publisher = OutboxPublisher(bus=bus)
    published_count = publisher.publish_pending_batch(db, batch_size=10, worker_id="recovered-pub")
    assert published_count == 1

    db.refresh(db_outbox)
    assert db_outbox.status == "PUBLISHED"

    # 4. Consumer receives and processes 1st stream delivery
    kw_count_1 = knowledge_worker.poll_and_process_batch(db, count=1)
    assert kw_count_1 == 1

    # Verify document & chunks created
    doc = db.query(Document).filter(Document.id == f"doc_{event.event_id}").first()
    assert doc is not None
    chunks_after_1 = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).all()
    initial_chunk_count = len(chunks_after_1)
    assert initial_chunk_count > 0

    # 5. Consumer receives 2nd duplicate stream delivery (resulting from publisher crash replay)
    kw_count_2 = knowledge_worker.poll_and_process_batch(db, count=1)
    assert kw_count_2 == 1  # Processed / late ACKed duplicate

    # 6. VERIFY: Zero duplicate business effects
    chunks_after_2 = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).all()
    assert len(chunks_after_2) == initial_chunk_count, "Duplicate transport delivery MUST NOT create duplicate chunks!"

    docs = db.query(Document).filter(Document.id == f"doc_{event.event_id}").all()
    assert len(docs) == 1, "There must be exactly ONE Document in DB."


def test_h6_redis_outage_outbox_recovery(db, org_a):
    """
    H6 — Redis Unavailable After PostgreSQL Commit.
    1. Webhook transaction succeeds in PostgreSQL.
    2. Redis is simulated as unavailable during first publish attempt.
    3. Outbox status becomes FAILED with last_error.
    4. Redis is restored.
    5. Outbox publisher recovers and successfully publishes.
    6. Worker processes event successfully.
    """
    bus = RedisEventBus()
    bus.ensure_consumer_groups()

    event = create_canonical_event(
        organization_id=org_a.id,
        provider="github",
        event_type="repository.pull_request.created",
        actor=ActorInfo(name="DevOps"),
        source=SourceInfo(provider="github", repository_id="acme/service"),
        occurred_at=datetime.now(timezone.utc),
        payload={"title": "Fix memory leak", "text": "PR description for redis outage recovery."},
        external_event_id="h6_redis_outage_001",
    )
    rec, is_new, outbox = EventIngestionService.ingest_event(db, event)
    assert is_new is True

    # Simulate failing publisher when Redis is down
    class FailingBus(RedisEventBus):
        def publish(self, *args, **kwargs):
            raise ConnectionError("Redis cluster connection refused (simulated outage)")

    failing_publisher = OutboxPublisher(bus=FailingBus())
    failing_publisher.publish_pending_batch(db, batch_size=10, worker_id="pub-during-outage")

    db.refresh(outbox)
    assert outbox.status == "FAILED"
    assert "simulated outage" in (outbox.last_error or "")
    assert outbox.attempts == 1

    # Restore Redis and re-run standard publisher
    normal_publisher = OutboxPublisher(bus=bus)
    success_count = normal_publisher.publish_pending_batch(db, batch_size=10, worker_id="pub-recovered")
    assert success_count == 1

    db.refresh(outbox)
    assert outbox.status == "PUBLISHED"
    assert outbox.attempts == 2

    # Worker processes successfully
    kw = KnowledgeWorker()
    kw_count = kw.poll_and_process_batch(db)
    assert kw_count == 1


def test_h7_redis_restart_consumer_recovery(db, org_a):
    """
    H7 — Redis Restart / Consumer Recovery.
    Verify consumer groups can re-initialize safely with MKSTREAM without destroying stream or dropping events.
    """
    bus = RedisEventBus()
    bus.ensure_consumer_groups()

    event = create_canonical_event(
        organization_id=org_a.id,
        provider="slack",
        event_type="message.created",
        actor=ActorInfo(name="Reboot Tester"),
        source=SourceInfo(provider="slack"),
        occurred_at=datetime.now(timezone.utc),
        payload={"text": "Message sent before simulated redis reconnection"},
        external_event_id="h7_reboot_001",
    )
    EventIngestionService.ingest_event(db, event)

    publisher = OutboxPublisher(bus=bus)
    publisher.publish_pending_batch(db)

    # Re-invoke ensure_consumer_groups (simulating reconnect / restart)
    bus.ensure_consumer_groups()

    kw = KnowledgeWorker()
    count = kw.poll_and_process_batch(db)
    assert count >= 1

    doc = db.query(Document).filter(Document.id == f"doc_{event.event_id}").first()
    assert doc is not None
