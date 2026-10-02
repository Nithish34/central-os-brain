import pytest
from datetime import datetime, timezone
from app.events.schemas import ActorInfo, SourceInfo
from app.events.factory import create_canonical_event
from app.events.ingestion import EventIngestionService
from app.events.outbox_publisher import OutboxPublisher
from app.events.bus import RedisEventBus
from app.models.canonical_event import CanonicalEventModel
from app.models.event_outbox import EventOutbox


def test_atomic_ingestion_and_outbox_creation(db, org_a):
    canonical = create_canonical_event(
        organization_id=org_a.id,
        provider="slack",
        event_type="slack.message",
        actor=ActorInfo(external_user_id="U1", name="Alice"),
        source=SourceInfo(provider="slack", workspace_id="W1", channel_id="C1"),
        occurred_at=datetime.now(timezone.utc),
        payload={"text": "Hello transactional outbox!"},
        external_event_id="slack_msg_100",
    )

    record, is_new, outbox = EventIngestionService.ingest_event(db, canonical)

    assert is_new is True
    assert record.id == canonical.event_id
    assert outbox is not None
    assert outbox.event_id == record.id
    assert outbox.status == "PENDING"
    assert outbox.attempts == 0

    # Verify DB persistence
    db_record = db.query(CanonicalEventModel).filter(CanonicalEventModel.id == record.id).first()
    db_outbox = db.query(EventOutbox).filter(EventOutbox.id == outbox.id).first()
    assert db_record is not None
    assert db_outbox is not None
    assert db_record.organization_id == org_a.id


def test_authoritative_idempotency_prevents_duplicate_outbox(db, org_a):
    canonical = create_canonical_event(
        organization_id=org_a.id,
        provider="slack",
        event_type="slack.message",
        actor=ActorInfo(external_user_id="U1", name="Alice"),
        source=SourceInfo(provider="slack", workspace_id="W1", channel_id="C1"),
        occurred_at=datetime.now(timezone.utc),
        payload={"text": "Testing duplicate webhook"},
        external_event_id="slack_msg_dedup_001",
    )

    # First delivery
    rec1, is_new1, out1 = EventIngestionService.ingest_event(db, canonical)
    assert is_new1 is True
    assert out1 is not None

    # Duplicate delivery
    rec2, is_new2, out2 = EventIngestionService.ingest_event(db, canonical)
    assert is_new2 is False
    assert out2 is None
    assert rec1.id == rec2.id

    # Check that only 1 outbox entry exists
    outbox_count = db.query(EventOutbox).filter(EventOutbox.event_id == rec1.id).count()
    assert outbox_count == 1


def test_outbox_publisher_batch_claim_and_publish(db, org_a):
    bus = RedisEventBus()
    publisher = OutboxPublisher(bus=bus)

    # Ingest 3 events
    for i in range(3):
        evt = create_canonical_event(
            organization_id=org_a.id,
            provider="github",
            event_type="github.pr.opened",
            actor=ActorInfo(name="Octocat"),
            source=SourceInfo(provider="github", repository_id="repo1"),
            occurred_at=datetime.now(timezone.utc),
            payload={"pr_num": i, "title": f"PR #{i}"},
            external_event_id=f"pr_event_{i}",
        )
        EventIngestionService.ingest_event(db, evt)

    # Before publishing
    pending_count = db.query(EventOutbox).filter(EventOutbox.status == "PENDING").count()
    assert pending_count >= 3

    # Run publisher batch
    published_count = publisher.publish_pending_batch(db, batch_size=10, worker_id="test-pub-1")
    assert published_count >= 3

    # Verify outbox rows updated to PUBLISHED
    published_rows = db.query(EventOutbox).filter(EventOutbox.status == "PUBLISHED").all()
    assert len(published_rows) >= 3
    for row in published_rows:
        assert row.published_at is not None
        assert row.claimed_by == "test-pub-1"
        assert row.attempts >= 1
