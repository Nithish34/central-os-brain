from datetime import datetime, timezone
from typing import Dict, Any, Optional
from pydantic import BaseModel, Field


def utcnow():
    return datetime.now(timezone.utc)


class ActorInfo(BaseModel):
    id: str = "unknown"
    display_name: str = "Unknown User"
    name: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None
    external_user_id: Optional[str] = None
    internal_user_id: Optional[str] = None

    def model_post_init(self, __context: Any) -> None:
        if not self.name and self.display_name:
            self.name = self.display_name
        elif not self.display_name and self.name:
            self.display_name = self.name
        if not self.external_user_id and self.id:
            self.external_user_id = self.id


class SourceInfo(BaseModel):
    provider: str = "unknown"
    workspace_id: Optional[str] = None
    channel_id: Optional[str] = None
    repository_id: Optional[str] = None
    resource_url: Optional[str] = None


class CanonicalEvent(BaseModel):
    event_id: str  # Format: evt_... (UUIDv7 or time-sortable hex)
    organization_id: str
    provider: str
    event_type: str
    external_event_id: Optional[str] = None
    external_account_id: Optional[str] = None
    actor: ActorInfo = Field(default_factory=ActorInfo)
    source: SourceInfo = Field(default_factory=SourceInfo)
    occurred_at: datetime
    received_at: datetime = Field(default_factory=utcnow)
    payload: Dict[str, Any] = Field(default_factory=dict)
    correlation_id: str
    causation_id: Optional[str] = None
    idempotency_key: str
    schema_version: str = "1.0.0"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class StreamEventEnvelope(BaseModel):
    stream_id: str
    event_id: str
    outbox_id: str
    run_id: str = "run_live_001"
    run_type: str = "LIVE"
    canonical_event: CanonicalEvent
    raw_payload: Optional[Dict[str, Any]] = None
