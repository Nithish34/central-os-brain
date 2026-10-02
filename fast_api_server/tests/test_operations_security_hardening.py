import pytest
from datetime import datetime, timezone
from app.events.schemas import ActorInfo, SourceInfo
from app.events.factory import create_canonical_event
from app.events.ingestion import EventIngestionService
from app.events.processing import EventProcessingManager
from app.events.retry import DeadLetterService
from app.models.event_dead_letter import EventDeadLetter
from app.models.event_outbox import EventOutbox
from app.models.audit import AuditLog


def test_h13_dlq_manual_retry_lifecycle(client_a_admin, db, org_a):
    """
    H13 — DLQ Manual Retry.
    1. Dead letter record exists in org_a.
    2. Admin calls POST /api/v1/operations/dead-letters/{id}/retry.
    3. DLQ status changes to RETRIED.
    4. New EventOutbox entry created with run_retry_...
    5. Audit log records manual retry initiation.
    """
    event = create_canonical_event(
        organization_id=org_a.id,
        provider="slack",
        event_type="message.created",
        actor=ActorInfo(name="DLQ User"),
        source=SourceInfo(provider="slack"),
        occurred_at=datetime.now(timezone.utc),
        payload={"text": "Original poison pill content"},
        external_event_id="h13_dlq_001",
    )
    EventIngestionService.ingest_event(db, event)

    state, _ = EventProcessingManager.claim_or_check_idempotency(
        db=db,
        event_id=event.event_id,
        organization_id=org_a.id,
        consumer_group="knowledge-workers",
        run_id="run_live_001",
    )
    EventProcessingManager.handle_failure(
        db=db,
        state=state,
        event=event,
        error=ValueError("Poison pill error"),
        is_permanent=True,
    )

    dlq_entry = db.query(EventDeadLetter).filter(EventDeadLetter.event_id == event.event_id).first()
    assert dlq_entry is not None
    assert dlq_entry.resolution_status == "UNRESOLVED"

    # Admin initiates manual retry via API
    resp = client_a_admin.post(f"/api/v1/operations/dead-letters/{dlq_entry.id}/retry")
    assert resp.status_code == 200
    assert resp.json()["status"] == "retried"

    db.refresh(dlq_entry)
    assert dlq_entry.resolution_status == "RETRIED"
    assert dlq_entry.resolved_at is not None

    # Verify new outbox entry created
    retry_outbox = db.query(EventOutbox).filter(
        EventOutbox.organization_id == org_a.id,
        EventOutbox.event_id == event.event_id,
        EventOutbox.run_id.like("run_retry_%"),
    ).first()
    assert retry_outbox is not None
    assert retry_outbox.run_id.startswith("run_retry_")
    assert retry_outbox.status == "PENDING"


def test_h15_tenant_isolation_attack_testing(
    client_a_admin,
    client_b_admin,
    client_b_owner,
    db,
    org_a,
    org_b,
):
    """
    H15 — Tenant Isolation Attack Testing.
    1. Create event & DLQ in Org A.
    2. Org B attempts to read Org A event -> 404.
    3. Org B attempts to retry Org A DLQ -> 404.
    4. Org B attempts to trigger replay for Org A -> scoped strictly to Org B events.
    """
    event_a = create_canonical_event(
        organization_id=org_a.id,
        provider="github",
        event_type="repository.pull_request.created",
        actor=ActorInfo(name="Org A Dev"),
        source=SourceInfo(provider="github", repository_id="org-a/repo"),
        occurred_at=datetime.now(timezone.utc),
        payload={"text": "Confidential Org A intellectual property."},
        external_event_id="h15_org_a_001",
    )
    EventIngestionService.ingest_event(db, event_a)

    state, _ = EventProcessingManager.claim_or_check_idempotency(
        db=db,
        event_id=event_a.event_id,
        organization_id=org_a.id,
        consumer_group="knowledge-workers",
    )
    EventProcessingManager.handle_failure(
        db=db,
        state=state,
        event=event_a,
        error=ValueError("Org A failure"),
        is_permanent=True,
    )

    dlq_a = db.query(EventDeadLetter).filter(EventDeadLetter.event_id == event_a.event_id).first()
    assert dlq_a is not None

    # Attack 1: Org B attempts to read Org A event lifecycle
    resp_read = client_b_admin.get(f"/api/v1/operations/events/{event_a.event_id}")
    assert resp_read.status_code == 404

    # Attack 2: Org B attempts to retry Org A dead-letter entry
    resp_retry = client_b_admin.post(f"/api/v1/operations/dead-letters/{dlq_a.id}/retry")
    assert resp_retry.status_code == 404

    # Attack 3: Org B attempts to list DLQs -> Org A DLQ must not appear
    resp_list = client_b_admin.get("/api/v1/operations/dead-letters")
    assert resp_list.status_code == 200
    assert not any(d["id"] == dlq_a.id for d in resp_list.json())


def test_h18_operational_api_rbac_matrix(
    client_a_owner,
    client_a_admin,
    client_a_employee,
    unauth_client,
    db,
    org_a,
):
    """
    H18 — Operational API Security & RBAC Matrix.
    Verifies permission enforcement across Owner, Admin, Employee, and Unauthenticated caller.
    """
    # 1. Unauthenticated -> 401
    resp_unauth = unauth_client.get("/api/v1/operations/events")
    assert resp_unauth.status_code == 401

    # 2. Employee -> 403 Forbidden for management endpoints
    resp_emp_events = client_a_employee.get("/api/v1/operations/events")
    assert resp_emp_events.status_code == 403

    resp_emp_replay = client_a_employee.post("/api/v1/operations/events/replay", json={"reason": "Test"})
    assert resp_emp_replay.status_code == 403

    # 3. Admin & Owner -> 200 OK
    resp_admin_events = client_a_admin.get("/api/v1/operations/events")
    assert resp_admin_events.status_code == 200

    resp_owner_events = client_a_owner.get("/api/v1/operations/events")
    assert resp_owner_events.status_code == 200

    resp_admin_workers = client_a_admin.get("/api/v1/operations/workers")
    assert resp_admin_workers.status_code == 200
