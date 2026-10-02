import pytest
from datetime import datetime, timezone
from app.events.schemas import ActorInfo, SourceInfo
from app.events.factory import create_canonical_event
from app.events.ingestion import EventIngestionService
from app.events.bus import RedisEventBus
from app.events.outbox_publisher import OutboxPublisher
from app.workers.knowledge_worker import KnowledgeWorker


def test_operations_events_ledger_and_lifecycle(
    client_a_admin,
    client_a_employee,
    client_b_admin,
    db,
    org_a,
):
    # Ingest test event
    event = create_canonical_event(
        organization_id=org_a.id,
        provider="slack",
        event_type="slack.message",
        actor=ActorInfo(name="Alice"),
        source=SourceInfo(provider="slack"),
        occurred_at=datetime.now(timezone.utc),
        payload={"text": "Operations test message"},
        external_event_id="ops_test_001",
    )
    EventIngestionService.ingest_event(db, event)

    # 1. Admin gets events list
    resp = client_a_admin.get("/api/v1/operations/events")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert any(e["event_id"] == event.event_id for e in data["events"])

    # 2. Employee cannot access operations (requires MANAGER or ADMIN)
    resp_emp = client_a_employee.get("/api/v1/operations/events")
    assert resp_emp.status_code == 403

    # 3. Lifecycle detail
    resp_detail = client_a_admin.get(f"/api/v1/operations/events/{event.event_id}")
    assert resp_detail.status_code == 200
    lifecycle = resp_detail.json()
    assert lifecycle["event_id"] == event.event_id
    assert len(lifecycle["outbox"]) >= 1
    assert lifecycle["provider"] == "slack"

    # 4. Org B admin cannot access Org A event lifecycle (404)
    resp_org_b = client_b_admin.get(f"/api/v1/operations/events/{event.event_id}")
    assert resp_org_b.status_code == 404


def test_operations_worker_metrics_and_replay_endpoint(
    client_a_admin,
    db,
    org_a,
):
    # Worker metrics
    resp_metrics = client_a_admin.get("/api/v1/operations/workers")
    assert resp_metrics.status_code == 200
    metrics_data = resp_metrics.json()
    assert metrics_data["status"] == "online"
    assert "knowledge-workers" in metrics_data["consumer_groups"]

    # Replay endpoint
    replay_payload = {
        "reason": "Test operational replay",
        "provider": "slack",
    }
    resp_replay = client_a_admin.post("/api/v1/operations/events/replay", json=replay_payload)
    assert resp_replay.status_code == 200
    replay_data = resp_replay.json()
    assert "run_id" in replay_data
    assert replay_data["reason"] == "Test operational replay"
