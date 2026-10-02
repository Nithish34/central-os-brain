import hmac
import hashlib
import json
import time
import pytest
from unittest.mock import patch
from app.core.config import settings
from app.events.bus import RedisEventBus
from app.events.outbox_publisher import OutboxPublisher
from app.workers.knowledge_worker import KnowledgeWorker
from app.models.canonical_event import CanonicalEventModel
from app.models.event_outbox import EventOutbox
from app.models.document import Document, DocumentChunk


def generate_slack_sig(body_bytes: bytes, timestamp: str, secret: str) -> str:
    sig_basestring = f"v0:{timestamp}:{body_bytes.decode('utf-8')}".encode("utf-8")
    return "v0=" + hmac.new(secret.encode("utf-8"), sig_basestring, hashlib.sha256).hexdigest()


def test_h5_postgres_unavailable_during_webhook_ingestion(unauth_client, db, org_a):
    """
    H5 — PostgreSQL Unavailable During Webhook Ingestion.
    Simulate database error during ingestion -> Webhook must return HTTP 5xx (not 200 OK).
    When DB is restored, retry succeeds.
    """
    payload = {
        "team_id": "T04839210",
        "event_id": "Ev_h5_db_fail",
        "event": {
            "type": "message",
            "client_msg_id": "msg-h5-db-fail-001",
            "user": "U_TESTER",
            "text": "Payload during simulated database failure",
            "channel": "C_TEST",
            "ts": str(time.time()),
        },
    }
    body_bytes = json.dumps(payload).encode("utf-8")
    timestamp = str(int(time.time()))
    signature = generate_slack_sig(body_bytes, timestamp, settings.SLACK_SIGNING_SECRET)
    headers = {
        "x-slack-request-timestamp": timestamp,
        "x-slack-signature": signature,
        "Content-Type": "application/json",
    }

    # 1. Simulate DB failure during ingestion
    from app.events.ingestion import EventIngestionService

    with patch.object(EventIngestionService, "ingest_event", side_effect=Exception("Database connection terminated")):
        resp_fail = unauth_client.post(
            f"/api/v1/integrations/slack/webhook?org_id={org_a.id}",
            content=body_bytes,
            headers=headers,
        )
        assert resp_fail.status_code == 500, f"Expected 500 on DB failure, got {resp_fail.status_code}"

    # 2. Restore DB -> Retry webhook
    resp_success = unauth_client.post(
        f"/api/v1/integrations/slack/webhook?org_id={org_a.id}",
        content=body_bytes,
        headers=headers,
    )
    assert resp_success.status_code == 200
    assert resp_success.json()["status"] == "ingested"


def test_h8_duplicate_webhook_storm(unauth_client, db, org_a):
    """
    H8 — Duplicate Webhook Storm.
    Send 100 identical webhook deliveries.
    Verify:
    1. First delivery returns 'ingested'
    2. Subsequent 99 deliveries return 'duplicate_ignored'
    3. Exactly 1 CanonicalEvent record in DB
    4. Exactly 1 EventOutbox record in DB
    5. Downstream: exactly 1 Document and deterministic vector chunks.
    """
    bus = RedisEventBus()
    bus.ensure_consumer_groups()

    payload = {
        "team_id": "T04839210",
        "event_id": "Ev_storm_999",
        "event": {
            "type": "message",
            "client_msg_id": "msg-storm-unique-001",
            "user": "U_STORM_USER",
            "text": "Storm verification payload with multiple chunk sentences. " * 5,
            "channel": "C_STORM",
            "ts": "1726914600.000100",
        },
    }
    body_bytes = json.dumps(payload).encode("utf-8")

    def get_headers(body: bytes):
        ts = str(int(time.time()))
        sig = generate_slack_sig(body, ts, settings.SLACK_SIGNING_SECRET)
        return {
            "x-slack-request-timestamp": ts,
            "x-slack-signature": sig,
            "Content-Type": "application/json",
        }

    # 1. First delivery
    resp1 = unauth_client.post(
        f"/api/v1/integrations/slack/webhook?org_id={org_a.id}",
        content=body_bytes,
        headers=get_headers(body_bytes),
    )
    assert resp1.status_code == 200
    assert resp1.json()["status"] == "ingested"
    event_id = resp1.json()["event_id"]

    # 2. Subsequent 99 deliveries (Webhook storm)
    for _ in range(99):
        resp_dup = unauth_client.post(
            f"/api/v1/integrations/slack/webhook?org_id={org_a.id}",
            content=body_bytes,
            headers=get_headers(body_bytes),
        )
        assert resp_dup.status_code == 200
        assert resp_dup.json()["status"] == "duplicate_ignored"

    # 3. Verify Database counts
    canonical_count = db.query(CanonicalEventModel).filter(
        CanonicalEventModel.organization_id == org_a.id,
        CanonicalEventModel.external_event_id == "msg-storm-unique-001",
    ).count()
    assert canonical_count == 1, "Exactly ONE canonical event record must exist in DB."

    outbox_count = db.query(EventOutbox).filter(
        EventOutbox.organization_id == org_a.id,
        EventOutbox.event_id == event_id,
    ).count()
    assert outbox_count == 1, "Exactly ONE outbox record must exist in DB."

    # 4. Drain through worker
    publisher = OutboxPublisher(bus=bus)
    publisher.publish_pending_batch(db)

    kw = KnowledgeWorker()
    kw.poll_and_process_batch(db)

    doc_count = db.query(Document).filter(Document.id == f"doc_{event_id}").count()
    assert doc_count == 1

    chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == f"doc_{event_id}").all()
    assert len(chunks) > 0
