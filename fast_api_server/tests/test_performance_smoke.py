import time
import numpy as np
import pytest
from datetime import datetime, timezone
from app.events.schemas import ActorInfo, SourceInfo
from app.events.factory import create_canonical_event
from app.events.ingestion import EventIngestionService
from app.events.bus import RedisEventBus
from app.events.outbox_publisher import OutboxPublisher
from app.workers.runner import WorkerRunner


def test_h20_performance_throughput_smoke_test(db, org_a):
    """
    H20 — Performance / Throughput Smoke Test.
    Runs controlled performance test with 100 events measuring:
    - Ingestion latency per event
    - Outbox publishing batch throughput
    - Worker processing latency
    - End-to-end latency metrics (p50, p95, p99)
    """
    num_events = 100
    bus = RedisEventBus()
    bus.ensure_consumer_groups()
    publisher = OutboxPublisher(bus=bus)
    runner = WorkerRunner(bus=bus, publisher=publisher)

    ingest_latencies_ms = []

    # 1. Ingestion Phase
    t_ingest_start = time.perf_counter()
    for i in range(num_events):
        t0 = time.perf_counter()
        event = create_canonical_event(
            organization_id=org_a.id,
            provider="slack",
            event_type="message.created",
            actor=ActorInfo(name=f"PerfUser-{i}"),
            source=SourceInfo(provider="slack", channel_id="C_PERF"),
            occurred_at=datetime.now(timezone.utc),
            payload={"text": f"Performance smoke test payload index #{i}"},
            external_event_id=f"h20_perf_{i:04d}",
        )
        EventIngestionService.ingest_event(db, event)
        t1 = time.perf_counter()
        ingest_latencies_ms.append((t1 - t0) * 1000)

    t_ingest_total = time.perf_counter() - t_ingest_start
    ingest_throughput = num_events / max(t_ingest_total, 0.001)

    # 2. Outbox & Processing Phase
    t_proc_start = time.perf_counter()
    stats = runner.process_all_pending(db, batch_size=num_events)
    t_proc_total = time.perf_counter() - t_proc_start

    assert stats["outbox_published"] == num_events
    assert stats["knowledge_processed"] == num_events
    assert stats["audit_processed"] == num_events

    p50 = float(np.percentile(ingest_latencies_ms, 50))
    p95 = float(np.percentile(ingest_latencies_ms, 95))
    p99 = float(np.percentile(ingest_latencies_ms, 99))

    print(f"\n[H20 Performance Summary]")
    print(f"Total Events: {num_events}")
    print(f"Ingestion Throughput: {ingest_throughput:.2f} events/sec")
    print(f"Ingestion Latency: p50={p50:.2f}ms, p95={p95:.2f}ms, p99={p99:.2f}ms")
    print(f"End-to-End Pipeline Duration: {t_proc_total:.3f}s")
    print(f"Published: {stats['outbox_published']}, Processed: {stats['knowledge_processed']}")

    # Sanity thresholds
    assert p95 < 200.0, f"p95 ingestion latency should be under 200ms, got {p95}ms"
    assert stats["knowledge_processed"] == num_events
