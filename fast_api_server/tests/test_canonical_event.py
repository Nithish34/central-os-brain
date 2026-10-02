from datetime import datetime, timezone
import pytest
from app.events.types import EventType, ProcessingStatus, RunType
from app.events.schemas import CanonicalEvent, ActorInfo, SourceInfo
from app.events.factory import (
    create_canonical_event,
    calculate_idempotency_key,
    generate_event_id,
    generate_outbox_id,
)


def test_canonical_event_creation_and_defaults():
    actor = ActorInfo(external_user_id="U12345", name="Priya Raman", email="priya@example.com")
    source = SourceInfo(provider="slack", workspace_id="T04839210", channel_id="C98765")
    occurred_at = datetime(2026, 9, 21, 10, 30, tzinfo=timezone.utc)
    payload = {"text": "Architecture decision confirmed: migrate to OAuth2."}

    event = create_canonical_event(
        organization_id="org-alpha",
        provider="slack",
        event_type=EventType.MESSAGE_CREATED.value,
        actor=actor,
        source=source,
        occurred_at=occurred_at,
        payload=payload,
        external_event_id="client_msg_999",
    )

    assert event.event_id.startswith("evt_")
    assert event.organization_id == "org-alpha"
    assert event.provider == "slack"
    assert event.event_type == "message.created"
    assert event.actor.name == "Priya Raman"
    assert event.source.channel_id == "C98765"
    assert event.idempotency_key.startswith("idmp_")
    assert event.correlation_id.startswith("corr_")
    assert event.schema_version == "1.0.0"
    assert isinstance(event.received_at, datetime)


def test_idempotency_key_determinism():
    org_id = "org-alpha"
    provider = "github"
    ext_id = "delivery-guid-12345"
    payload = {"action": "opened", "pull_request": {"id": 100}}

    key1 = calculate_idempotency_key(org_id, provider, ext_id, payload)
    key2 = calculate_idempotency_key(org_id, provider, ext_id, payload)
    assert key1 == key2

    # Different org produces different key
    key_diff_org = calculate_idempotency_key("org-beta", provider, ext_id, payload)
    assert key1 != key_diff_org

    # Without external_event_id, hashing deterministic payload
    key_no_ext_1 = calculate_idempotency_key(org_id, provider, None, {"key": "val", "num": 1})
    key_no_ext_2 = calculate_idempotency_key(org_id, provider, None, {"num": 1, "key": "val"})
    assert key_no_ext_1 == key_no_ext_2


def test_mutable_default_safety():
    # Verify no mutable shared state between instances
    e1 = create_canonical_event(
        organization_id="org-a",
        provider="slack",
        event_type="test",
        actor=ActorInfo(),
        source=SourceInfo(provider="slack"),
        occurred_at=datetime.now(timezone.utc),
        payload={"a": 1},
    )
    e2 = create_canonical_event(
        organization_id="org-a",
        provider="slack",
        event_type="test",
        actor=ActorInfo(),
        source=SourceInfo(provider="slack"),
        occurred_at=datetime.now(timezone.utc),
        payload={"b": 2},
    )

    e1.metadata["custom"] = "val"
    assert "custom" not in e2.metadata
    assert e1.payload != e2.payload
