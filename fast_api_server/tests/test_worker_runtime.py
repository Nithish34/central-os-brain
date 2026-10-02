import pytest
import json
from datetime import datetime, timezone
from app.events.schemas import ActorInfo, SourceInfo
from app.events.factory import create_canonical_event
from app.events.ingestion import EventIngestionService
from app.events.bus import RedisEventBus
from app.events.outbox_publisher import OutboxPublisher
from app.workers.knowledge_worker import KnowledgeWorker
from app.workers.workflow_worker import WorkflowWorker
from app.workers.audit_worker import AuditWorker
from app.models.document import DocumentChunk, Document
from app.models.event import CompanyEvent
from app.models.audit import AuditLog
from app.models.event_processing import EventProcessingState


def test_worker_runtime_e2e_and_late_ack(db, org_a):
    bus = RedisEventBus()
    publisher = OutboxPublisher(bus=bus)
    knowledge_worker = KnowledgeWorker()
    audit_worker = AuditWorker()

    # 1. Ingest Event
    event = create_canonical_event(
        organization_id=org_a.id,
        provider="slack",
        event_type="slack.message",
        actor=ActorInfo(external_user_id="U1", name="Alice Tech Lead"),
        source=SourceInfo(provider="slack", workspace_id="T1", channel_id="C_eng"),
        occurred_at=datetime.now(timezone.utc),
        payload={"text": "Architecture decision: All services migrate to async streaming."},
        external_event_id="slack_arch_001",
    )
    rec, is_new, outbox = EventIngestionService.ingest_event(db, event)
    assert is_new is True

    # 2. Publish via Outbox
    pub_count = publisher.publish_pending_batch(db, batch_size=10)
    assert pub_count >= 1

    # 3. Knowledge Worker Process
    kw_count = knowledge_worker.poll_and_process_batch(db, count=10)
    assert kw_count >= 1

    # Verify Knowledge Worker persisted Document & Chunks
    doc = db.query(Document).filter(Document.id == f"doc_{event.event_id}").first()
    assert doc is not None
    chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).all()
    assert len(chunks) >= 1
    assert chunks[0].embedding_json is not None

    # Verify processing state marked COMPLETED
    kw_state = db.query(EventProcessingState).filter(
        EventProcessingState.event_id == event.event_id,
        EventProcessingState.consumer_group == "knowledge-workers",
    ).first()
    assert kw_state is not None
    assert kw_state.status == "COMPLETED"

    # 4. Audit Worker Process
    aw_count = audit_worker.poll_and_process_batch(db, count=10)
    assert aw_count >= 1

    # Verify Audit log written
    audit_log = db.query(AuditLog).filter(
        AuditLog.organization_id == org_a.id,
        AuditLog.target == event.event_id,
    ).first()
    assert audit_log is not None
    assert "slack.message" in audit_log.title


def test_deterministic_chunking_and_replay_vector_upsert_idempotency(db, org_a):
    bus = RedisEventBus()
    publisher = OutboxPublisher(bus=bus)
    knowledge_worker = KnowledgeWorker()

    event = create_canonical_event(
        organization_id=org_a.id,
        provider="github",
        event_type="github.pr.opened",
        actor=ActorInfo(name="Octocat"),
        source=SourceInfo(provider="github", repository_id="acme/core"),
        occurred_at=datetime.now(timezone.utc),
        payload={"text": "A detailed pull request description with multi-chunk text " * 10},
        external_event_id="pr_upsert_001",
    )
    EventIngestionService.ingest_event(db, event, run_id="run_live_001")
    publisher.publish_pending_batch(db)
    knowledge_worker.poll_and_process_batch(db)

    # Initial chunk count
    initial_chunks = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == f"doc_{event.event_id}"
    ).all()
    initial_count = len(initial_chunks)
    assert initial_count > 0

    # Simulate Replay under run_replay_002
    from app.models.event_outbox import EventOutbox
    from app.events.factory import generate_outbox_id

    replay_outbox = EventOutbox(
        id=generate_outbox_id(),
        organization_id=org_a.id,
        event_id=event.event_id,
        run_id="run_replay_002",
        topic="company_brain:events",
        payload_json=event.model_dump_json(),
        status="PENDING",
        attempts=0,
    )
    db.add(replay_outbox)
    db.commit()

    publisher.publish_pending_batch(db)
    knowledge_worker.poll_and_process_batch(db)

    # Post-replay chunk count MUST BE EXACTLY THE SAME (idempotent UPSERT)
    post_replay_chunks = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == f"doc_{event.event_id}"
    ).all()
    assert len(post_replay_chunks) == initial_count, "Replay must UPSERT without creating duplicate vector chunks!"
