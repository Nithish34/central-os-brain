import hmac
import hashlib
import time
import json
import pytest
from datetime import datetime, timezone
from app.core.config import settings
from app.events.schemas import ActorInfo, SourceInfo
from app.events.factory import create_canonical_event
from app.events.ingestion import EventIngestionService
from app.events.bus import RedisEventBus
from app.events.outbox_publisher import OutboxPublisher
from app.events.processing import EventProcessingManager
from app.events.replay import EventReplayService
from app.workers.knowledge_worker import KnowledgeWorker
from app.workers.workflow_worker import WorkflowWorker
from app.workers.audit_worker import AuditWorker
from app.models.canonical_event import CanonicalEventModel
from app.models.event_outbox import EventOutbox
from app.models.event_processing import EventProcessingState
from app.models.event_dead_letter import EventDeadLetter
from app.models.document import Document, DocumentChunk
from app.models.audit import AuditLog
from app.models.integration import IntegrationAccount, IntegrationStatusEnum


def generate_slack_sig(body_bytes: bytes, timestamp: str, secret: str) -> str:
    sig_basestring = f"v0:{timestamp}:{body_bytes.decode('utf-8')}".encode("utf-8")
    return "v0=" + hmac.new(secret.encode("utf-8"), sig_basestring, hashlib.sha256).hexdigest()


def test_phase4_golden_acceptance_flow(unauth_client, db, org_a):
    """
    Phase 4 Golden Acceptance Test:
    Complete end-to-end verification of the 8-step Event-Driven Data Platform architecture.
    """
    # 0. Setup: Ensure integration account exists for Org A
    integration = IntegrationAccount(
        id="int_slack_test",
        organization_id=org_a.id,
        provider="slack",
        name="Slack Test Connector",
        status=IntegrationStatusEnum.CONNECTED.value,
        webhook_secret=settings.SLACK_SIGNING_SECRET,
    )
    db.add(integration)
    db.commit()

    bus = RedisEventBus()
    bus.ensure_consumer_groups()
    publisher = OutboxPublisher(bus=bus)
    knowledge_worker = KnowledgeWorker()
    workflow_worker = WorkflowWorker()
    audit_worker = AuditWorker()

    # =========================================================================
    # Step 1 & 2: Inbound Webhook Arrives & Signature Verified + Normalized
    # =========================================================================
    webhook_payload = {
        "team_id": "T04839210",
        "event_id": "Ev_golden_slack_001",
        "event_time": int(time.time()),
        "event": {
            "type": "message",
            "client_msg_id": "msg-golden-slack-001",
            "user": "U_GOLDEN_LEAD",
            "text": "Golden Architecture Decision: Decoupled transactional outbox verified for enterprise deployment.",
            "channel": "C_ARCH_CORE",
            "ts": str(time.time()),
        },
    }
    body_bytes = json.dumps(webhook_payload).encode("utf-8")
    timestamp = str(int(time.time()))
    signature = generate_slack_sig(body_bytes, timestamp, settings.SLACK_SIGNING_SECRET)

    # =========================================================================
    # Step 3: Atomic DB Write (canonical_events + event_outbox) -> 200 OK
    # =========================================================================
    headers = {
        "x-slack-request-timestamp": timestamp,
        "x-slack-signature": signature,
        "Content-Type": "application/json",
    }
    resp = unauth_client.post(
        f"/api/v1/integrations/slack/webhook?org_id={org_a.id}",
        content=body_bytes,
        headers=headers,
    )
    assert resp.status_code == 200
    resp_data = resp.json()
    assert resp_data["status"] == "ingested"
    event_id = resp_data["event_id"]

    # Verify atomic DB persistence
    canonical_record = db.query(CanonicalEventModel).filter(CanonicalEventModel.id == event_id).first()
    assert canonical_record is not None
    assert canonical_record.organization_id == org_a.id

    outbox_entry = db.query(EventOutbox).filter(EventOutbox.event_id == event_id).first()
    assert outbox_entry is not None
    assert outbox_entry.status == "PENDING"
    assert outbox_entry.run_id == "run_live_001"

    # =========================================================================
    # Step 4: Outbox Publisher Claims Batch (SKIP LOCKED) and Pushes to Redis
    # =========================================================================
    published = publisher.publish_pending_batch(db, batch_size=10, worker_id="golden-publisher")
    assert published >= 1

    db.refresh(outbox_entry)
    assert outbox_entry.status == "PUBLISHED"
    assert outbox_entry.published_at is not None

    # =========================================================================
    # Step 5: Independent Consumer Groups Process & Late ACK
    # =========================================================================
    kw_count = knowledge_worker.poll_and_process_batch(db)
    assert kw_count >= 1

    wf_count = workflow_worker.poll_and_process_batch(db)
    assert wf_count >= 1

    aw_count = audit_worker.poll_and_process_batch(db)
    assert aw_count >= 1

    # Verify Knowledge Worker produced Document and DocumentChunks
    doc = db.query(Document).filter(Document.id == f"doc_{event_id}").first()
    assert doc is not None
    initial_chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).all()
    assert len(initial_chunks) >= 1
    initial_chunk_count = len(initial_chunks)

    # Verify Audit Worker wrote AuditLog
    audit_entry = db.query(AuditLog).filter(
        AuditLog.organization_id == org_a.id,
        AuditLog.target == event_id,
    ).first()
    assert audit_entry is not None

    # =========================================================================
    # Step 6: Duplicate Webhook Delivered -> Caught by DB Idempotency Constraint
    # =========================================================================
    dup_resp = unauth_client.post(
        f"/api/v1/integrations/slack/webhook?org_id={org_a.id}",
        content=body_bytes,
        headers=headers,
    )
    assert dup_resp.status_code == 200
    dup_data = dup_resp.json()
    assert dup_data["status"] == "duplicate_ignored"

    # Verify zero duplicate outbox records created
    total_outbox_for_event = db.query(EventOutbox).filter(EventOutbox.event_id == event_id).count()
    assert total_outbox_for_event == 1

    # =========================================================================
    # Step 7: Failure Injected in Knowledge Worker -> Poison Pill Routes to DLQ
    # =========================================================================
    poison_event = create_canonical_event(
        organization_id=org_a.id,
        provider="slack",
        event_type="malformed.event",
        actor=ActorInfo(name="Poison Pill User"),
        source=SourceInfo(provider="slack"),
        occurred_at=datetime.now(timezone.utc),
        payload={"invalid_binary": "\x00\xff-corrupt"},
        external_event_id="poison_msg_001",
    )
    EventIngestionService.ingest_event(db, poison_event)
    publisher.publish_pending_batch(db)

    # Simulate worker raising permanent ValueError on poison pill
    poison_env = bus.read_group("knowledge-workers", "kw-test-1", count=10)
    for env in poison_env:
        if env.event_id == poison_event.event_id:
            # Simulate failure routing
            state, _ = EventProcessingManager.claim_or_check_idempotency(
                db=db,
                event_id=poison_event.event_id,
                organization_id=org_a.id,
                consumer_group="knowledge-workers",
                run_id=env.run_id,
                worker_id="kw-test-1",
            )
            EventProcessingManager.handle_failure(
                db=db,
                state=state,
                event=poison_event,
                error=ValueError("Poison pill malformed payload encountered"),
                is_permanent=True,
            )
            bus.ack("knowledge-workers", env.stream_id)

    # Verify routed to event_dead_letters for knowledge-workers ONLY
    dlq_entry = db.query(EventDeadLetter).filter(
        EventDeadLetter.event_id == poison_event.event_id,
        EventDeadLetter.consumer_group == "knowledge-workers",
    ).first()
    assert dlq_entry is not None
    assert dlq_entry.resolution_status == "UNRESOLVED"

    # =========================================================================
    # Step 8: Replay Triggered with new run_id -> Deterministic Vector UPSERT
    # =========================================================================
    replay_res = EventReplayService.trigger_replay(
        db=db,
        organization_id=org_a.id,
        requested_by="admin@alpha.example.com",
        reason="Model upgrade v2 replay verification",
        provider="slack",
    )
    assert replay_res["status"] == "queued"
    replay_run_id = replay_res["run_id"]
    assert replay_run_id.startswith("run_replay_")

    # Publish replay batch & process with knowledge worker
    pub_replay_count = publisher.publish_pending_batch(db)
    assert pub_replay_count >= 1

    kw_replay_count = knowledge_worker.poll_and_process_batch(db)
    assert kw_replay_count >= 1

    # Verify zero duplicate chunks created (deterministic upsert)
    post_replay_chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).all()
    assert len(post_replay_chunks) == initial_chunk_count, (
        f"Replay MUST NOT double vector chunks! Expected {initial_chunk_count}, got {len(post_replay_chunks)}"
    )

    # Verify processing state recorded under replay_run_id
    replay_proc_state = db.query(EventProcessingState).filter(
        EventProcessingState.event_id == event_id,
        EventProcessingState.consumer_group == "knowledge-workers",
        EventProcessingState.run_id == replay_run_id,
    ).first()
    assert replay_proc_state is not None
    assert replay_proc_state.status == "COMPLETED"
    assert replay_proc_state.run_type == "REPLAY"
