import uuid
import hashlib
import json
import time
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from app.events.schemas import CanonicalEvent, ActorInfo, SourceInfo


def generate_event_id() -> str:
    # Time-sortable event ID
    ts_ms = int(time.time() * 1000)
    rand_hex = uuid.uuid4().hex[:12]
    return f"evt_{ts_ms}_{rand_hex}"


def generate_outbox_id() -> str:
    ts_ms = int(time.time() * 1000)
    rand_hex = uuid.uuid4().hex[:12]
    return f"obx_{ts_ms}_{rand_hex}"


def generate_correlation_id() -> str:
    return f"corr_{uuid.uuid4().hex}"


def calculate_idempotency_key(
    organization_id: str,
    provider: str,
    external_event_id: Optional[str] = None,
    payload: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Calculates provider-aware idempotency key.
    If external_event_id exists (e.g. Slack client_msg_id, GitHub delivery ID), uses that.
    Otherwise hashes the payload deterministically.
    """
    if external_event_id:
        seed = f"{organization_id}:{provider}:{external_event_id}"
    else:
        payload_str = json.dumps(payload or {}, sort_keys=True)
        seed = f"{organization_id}:{provider}:{payload_str}"
    return f"idmp_{hashlib.sha256(seed.encode('utf-8')).hexdigest()[:24]}"


def create_canonical_event(
    organization_id: str,
    provider: str,
    event_type: str,
    actor: ActorInfo,
    source: SourceInfo,
    occurred_at: datetime,
    payload: Dict[str, Any],
    external_event_id: Optional[str] = None,
    external_account_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
    causation_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> CanonicalEvent:
    event_id = generate_event_id()
    corr_id = correlation_id or generate_correlation_id()
    idmp_key = calculate_idempotency_key(organization_id, provider, external_event_id, payload)

    return CanonicalEvent(
        event_id=event_id,
        organization_id=organization_id,
        provider=provider.lower(),
        event_type=event_type,
        external_event_id=external_event_id,
        external_account_id=external_account_id,
        actor=actor,
        source=source,
        occurred_at=occurred_at,
        received_at=datetime.now(timezone.utc),
        payload=payload,
        correlation_id=corr_id,
        causation_id=causation_id,
        idempotency_key=idmp_key,
        schema_version="1.0.0",
        metadata=metadata or {},
    )
