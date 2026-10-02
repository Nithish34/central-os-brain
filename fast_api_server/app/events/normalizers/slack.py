from datetime import datetime, timezone
from typing import Dict, Any, Optional
from app.events.schemas import CanonicalEvent, ActorInfo, SourceInfo
from app.events.factory import create_canonical_event
from app.events.types import EventType
from app.events.normalizers.base import BaseEventNormalizer


class SlackEventNormalizer(BaseEventNormalizer):
    provider: str = "slack"

    def normalize(
        self,
        payload: Dict[str, Any],
        organization_id: str,
        headers: Optional[Dict[str, str]] = None,
        correlation_id: Optional[str] = None,
    ) -> CanonicalEvent:
        event = payload.get("event", {})
        subtype = event.get("subtype")

        if subtype == "message_changed":
            event_type = EventType.MESSAGE_UPDATED.value
            msg_data = event.get("message", {})
        elif subtype == "message_deleted":
            event_type = EventType.MESSAGE_DELETED.value
            msg_data = event.get("previous_message", {})
        else:
            event_type = EventType.MESSAGE_CREATED.value
            msg_data = event

        user_id = msg_data.get("user") or event.get("user") or "U_UNKNOWN"
        channel_id = event.get("channel") or "general"
        text = msg_data.get("text", "")
        ts_str = msg_data.get("ts") or event.get("ts") or str(datetime.now().timestamp())

        try:
            occurred_at = datetime.fromtimestamp(float(ts_str), tz=timezone.utc)
        except Exception:
            occurred_at = datetime.now(timezone.utc)

        # External event ID for Slack
        external_id = msg_data.get("client_msg_id") or payload.get("event_id") or f"slack_msg_{channel_id}_{ts_str}"
        workspace_id = payload.get("team_id")

        actor = ActorInfo(
            id=user_id,
            display_name=msg_data.get("username") or user_id,
        )

        source = SourceInfo(
            provider="slack",
            workspace_id=workspace_id,
            channel_id=channel_id,
            resource_url=f"https://slack.com/archives/{channel_id}/p{ts_str.replace('.', '')}",
        )

        event_payload = {
            "text": text,
            "channel": channel_id,
            "thread_ts": event.get("thread_ts"),
            "subtype": subtype,
            "raw_text": text,
        }

        return create_canonical_event(
            organization_id=organization_id,
            provider="slack",
            event_type=event_type,
            actor=actor,
            source=source,
            occurred_at=occurred_at,
            payload=event_payload,
            external_event_id=external_id,
            external_account_id=workspace_id,
            correlation_id=correlation_id,
            metadata={"slack_team_id": workspace_id, "slack_api_app_id": payload.get("api_app_id")},
        )


slack_normalizer = SlackEventNormalizer()
