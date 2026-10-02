import pytest
from datetime import datetime, timezone
from app.events.schemas import ActorInfo, SourceInfo
from app.events.factory import create_canonical_event
from app.events.ingestion import EventIngestionService
from app.events.replay import EventReplayService
from app.models.event_outbox import EventOutbox
from app.models.audit import AuditLog


def test_event_replay_creates_distinct_run_id_and_outbox(db, org_a, org_b):
    # Create events for Org A
    for i in range(3):
        evt = create_canonical_event(
            organization_id=org_a.id,
            provider="slack",
            event_type="slack.message",
            actor=ActorInfo(name="User A"),
            source=SourceInfo(provider="slack"),
            occurred_at=datetime.now(timezone.utc),
            payload={"msg": f"Org A message {i}"},
            external_event_id=f"org_a_msg_{i}",
        )
        EventIngestionService.ingest_event(db, evt)

    # Create event for Org B
    evt_b = create_canonical_event(
        organization_id=org_b.id,
        provider="slack",
        event_type="slack.message",
        actor=ActorInfo(name="User B"),
        source=SourceInfo(provider="slack"),
        occurred_at=datetime.now(timezone.utc),
        payload={"msg": "Org B message"},
        external_event_id="org_b_msg_0",
    )
    EventIngestionService.ingest_event(db, evt_b)

    # Trigger Replay for Org A only
    result = EventReplayService.trigger_replay(
        db=db,
        organization_id=org_a.id,
        requested_by="admin@alpha.example.com",
        reason="Upgraded knowledge embedding model v2",
        provider="slack",
    )

    assert result["status"] == "queued"
    assert result["events_replayed_count"] == 3
    assert result["run_id"].startswith("run_replay_")

    # Verify outbox rows created for Org A under the replay run_id
    replay_outbox_rows = db.query(EventOutbox).filter(
        EventOutbox.organization_id == org_a.id,
        EventOutbox.run_id == result["run_id"],
    ).all()
    assert len(replay_outbox_rows) == 3

    # Verify Org B has zero replay outbox rows
    org_b_replay_rows = db.query(EventOutbox).filter(
        EventOutbox.organization_id == org_b.id,
        EventOutbox.run_id == result["run_id"],
    ).all()
    assert len(org_b_replay_rows) == 0

    # Verify Replay Audit Log
    audit = db.query(AuditLog).filter(
        AuditLog.organization_id == org_a.id,
        AuditLog.action == "event.replay.triggered",
    ).first()
    assert audit is not None
    assert audit.target == result["run_id"]
    assert "Upgraded knowledge embedding model v2" in audit.reason
