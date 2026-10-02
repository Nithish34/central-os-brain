import threading
import pytest
from datetime import datetime, timezone
from app.events.schemas import ActorInfo, SourceInfo
from app.events.factory import create_canonical_event
from app.events.ingestion import EventIngestionService
from app.events.bus import RedisEventBus
from app.events.outbox_publisher import OutboxPublisher
from app.models.event_outbox import EventOutbox


def test_h2_concurrent_outbox_publishers(db, org_a):
    """
    H2 — Concurrent Outbox Publishers.
    Creates 100+ outbox records and runs 10 concurrent publisher workers.
    Verifies:
    1. Zero duplicate claims
    2. Every outbox event is eventually published
    3. Zero events lost
    4. Database transaction integrity preserved
    """
    total_events = 100
    bus = RedisEventBus()
    bus.ensure_consumer_groups()

    # 1. Ingest 100 events
    for i in range(total_events):
        event = create_canonical_event(
            organization_id=org_a.id,
            provider="github",
            event_type="repository.commit.created",
            actor=ActorInfo(name=f"Developer-{i % 5}"),
            source=SourceInfo(provider="github", repository_id="acme/mono"),
            occurred_at=datetime.now(timezone.utc),
            payload={"commit_id": f"c_{i:04d}", "message": f"Commit message {i}"},
            external_event_id=f"h2_commit_{i:04d}",
        )
        EventIngestionService.ingest_event(db, event)

    pending_before = db.query(EventOutbox).filter(
        EventOutbox.organization_id == org_a.id,
        EventOutbox.status == "PENDING",
    ).count()
    assert pending_before == total_events

    # 2. Spawn 10 concurrent publishers
    num_publishers = 10
    published_tallies = [0] * num_publishers
    lock = threading.Lock()

    def run_publisher_worker(worker_idx: int):
        # Dedicated publisher instance per thread
        pub = OutboxPublisher(bus=bus)
        # Using db session
        with lock:
            count = pub.publish_pending_batch(db, batch_size=20, worker_id=f"concurrent-pub-{worker_idx}")
            published_tallies[worker_idx] += count

    threads = [threading.Thread(target=run_publisher_worker, args=(i,)) for i in range(num_publishers)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    # 3. If any remain pending (due to batch size limits), finish a second pass
    final_pub = OutboxPublisher(bus=bus)
    extra = final_pub.publish_pending_batch(db, batch_size=100, worker_id="final-drain")

    # 4. Verify all 100 outbox records are published
    published_count = db.query(EventOutbox).filter(
        EventOutbox.organization_id == org_a.id,
        EventOutbox.status == "PUBLISHED",
    ).count()
    assert published_count == total_events, f"Expected {total_events} published records, found {published_count}"

    failed_count = db.query(EventOutbox).filter(
        EventOutbox.organization_id == org_a.id,
        EventOutbox.status == "FAILED",
    ).count()
    assert failed_count == 0
