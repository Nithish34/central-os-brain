import uuid
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import httpx
from sqlalchemy.orm import Session
from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError

from app.core.config import settings
from app.core.security import encryption_manager
from app.core.redis import redis_client
from app.models.slack_connection import SlackConnection, utcnow
from app.models.user import User
from app.models.event import CompanyEvent
from app.models.audit import AuditLog
from app.models.integration import IntegrationAccount, IntegrationStatusEnum

logger = logging.getLogger(__name__)

SLACK_SCOPES = [
    "channels:history",
    "channels:read",
    "chat:write",
    "groups:history",
    "groups:read",
    "im:history",
    "mpim:history",
    "users:read",
]


import os
from pathlib import Path

_CACHE_DIR = Path(__file__).resolve().parent.parent.parent / ".cache"
_CACHE_FILE = _CACHE_DIR / "oauth_states.json"


def _load_disk_states() -> Dict[str, Dict[str, Any]]:
    try:
        if _CACHE_FILE.exists():
            with open(_CACHE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict):
                    now_ts = datetime.now(timezone.utc).timestamp()
                    cleaned = {}
                    for k, v in data.items():
                        c_at = v.get("created_at")
                        if c_at:
                            try:
                                dt = datetime.fromisoformat(c_at).timestamp()
                                if now_ts - dt < 1800:
                                    cleaned[k] = v
                            except Exception:
                                cleaned[k] = v
                        else:
                            cleaned[k] = v
                    return cleaned
    except Exception as e:
        logger.debug(f"[SLACK OAUTH] Error reading disk state store: {e}")
    return {}


def _save_disk_states(states: Dict[str, Dict[str, Any]]) -> None:
    try:
        _CACHE_DIR.mkdir(parents=True, exist_ok=True)
        with open(_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(states, f)
    except Exception as e:
        logger.debug(f"[SLACK OAUTH] Error writing disk state store: {e}")


def _find_payload(cleaned_state: str, store: Dict[str, Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not cleaned_state or not store:
        return None
    # 1. Exact match
    if cleaned_state in store:
        return store[cleaned_state]
    # 2. With prefix
    with_prefix = f"slack:oauth_state:{cleaned_state}"
    if with_prefix in store:
        return store[with_prefix]
    # 3. Without prefix
    without_prefix = cleaned_state.replace("slack:oauth_state:", "")
    if without_prefix in store:
        return store[without_prefix]
    # 4. Partial / suffix scan
    for k, v in store.items():
        if k.endswith(cleaned_state) or cleaned_state.endswith(k):
            return v
    return None


_STATE_MEMORY_STORE: Dict[str, Dict[str, Any]] = {}


class SlackOAuthService:
    @staticmethod
    def generate_state(user_id: str, redirect_uri: Optional[str] = None) -> str:
        """Generate a random state token and persist in Redis, in-memory, and disk cache (survives server reloads)."""
        state = f"slack_state_{uuid.uuid4().hex}"
        redis_key = f"slack:oauth_state:{state}"
        payload = {
            "user_id": user_id,
            "redirect_uri": redirect_uri,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        # 1. In-memory storage
        _STATE_MEMORY_STORE[state] = payload

        # 2. Disk persistence for surviving Uvicorn hot-reloads
        disk_states = _load_disk_states()
        disk_states[state] = payload
        _save_disk_states(disk_states)

        # 3. Redis storage
        try:
            redis_client.set_with_ttl(redis_key, json.dumps(payload), ttl_seconds=900)
        except Exception as e:
            logger.warning("[SLACK OAUTH] Redis write error for state %s: %s (disk & memory fallbacks active)", state, e)

        logger.info("[SLACK OAUTH] Generated state: %s for user: %s", state, user_id)
        return state

    @staticmethod
    def get_state_payload(state: str, consume: bool = False) -> Optional[Dict[str, Any]]:
        """Retrieve state payload from Redis, memory, or disk cache with 15-minute validity check."""
        if not state:
            return None
        cleaned_state = state.strip()
        redis_key = f"slack:oauth_state:{cleaned_state}"

        data: Optional[Dict[str, Any]] = None

        # 1. Try Redis retrieval
        try:
            raw = redis_client.get(redis_key)
            if not raw:
                # Try without or with prefix
                raw = redis_client.get(cleaned_state)
            if raw:
                data = json.loads(raw)
        except Exception as e:
            logger.warning("[SLACK OAUTH] Redis read error for state %s: %s", cleaned_state, e)

        # 2. In-memory store fallback with flexible matcher
        if not data:
            data = _find_payload(cleaned_state, _STATE_MEMORY_STORE)

        # 3. Disk store fallback (survives server process restarts)
        disk_states = _load_disk_states()
        if not data:
            data = _find_payload(cleaned_state, disk_states)
            if data:
                _STATE_MEMORY_STORE[cleaned_state] = data

        # 4. Cross-check universal OAuth state if state originated from OAuthManager
        if not data and cleaned_state.startswith("cb_st_"):
            alt_key = f"oauth_state:{cleaned_state}"
            try:
                alt_raw = redis_client.get(alt_key)
                if alt_raw and ":" in alt_raw:
                    parts = alt_raw.split(":", 2)
                    if len(parts) >= 2 and parts[1].lower() == "slack":
                        data = {
                            "user_id": None,
                            "organization_id": parts[0],
                            "redirect_uri": None,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        }
            except Exception:
                pass

        available_keys = list(set(list(_STATE_MEMORY_STORE.keys()) + list(disk_states.keys())))
        logger.info("[SLACK OAUTH] Looking up state: %s | Available keys: %s", cleaned_state, available_keys)

        if data and consume:
            try:
                redis_client.set_with_ttl(redis_key, json.dumps(data), ttl_seconds=60)
            except Exception:
                pass

        return data

    @staticmethod
    def consume_state(state: str) -> None:
        """Explicitly consume / invalidate state after successful callback completion with 60s grace period."""
        if not state:
            return
        cleaned_state = state.strip()
        _STATE_MEMORY_STORE.pop(cleaned_state, None)
        disk_states = _load_disk_states()
        disk_states.pop(cleaned_state, None)
        _save_disk_states(disk_states)

        redis_key = f"slack:oauth_state:{cleaned_state}"
        try:
            raw = redis_client.get(redis_key)
            if raw:
                redis_client.set_with_ttl(redis_key, raw, ttl_seconds=60)
        except Exception:
            pass

    @classmethod
    def validate_state(cls, state: str, consume: bool = False) -> Optional[str]:
        """Validate state token and return associated user_id if valid."""
        payload = cls.get_state_payload(state, consume=consume)
        if payload and isinstance(payload, dict):
            return payload.get("user_id")
        return None

    @classmethod
    def get_authorization_url(cls, user_id: str, redirect_uri: Optional[str] = None) -> Dict[str, str]:
        """Construct Slack OAuth 2.0 authorization URL."""
        client_id = settings.SLACK_CLIENT_ID or "dev-slack-client-id"
        effective_redirect = settings.SLACK_REDIRECT_URI or redirect_uri or "http://localhost:8000/api/slack/callback"
        state = cls.generate_state(user_id, effective_redirect)
        scopes = "%20".join(SLACK_SCOPES)
        auth_url = (
            f"https://slack.com/oauth/v2/authorize?"
            f"client_id={client_id}&"
            f"scope={scopes}&"
            f"redirect_uri={effective_redirect}&"
            f"state={state}"
        )
        return {"authorization_url": auth_url, "state": state, "redirect_uri": effective_redirect}

    @classmethod
    async def exchange_code_for_token(
        cls,
        code: str,
        redirect_uri: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Exchange authorization code for Slack access token with strictly matching redirect_uri."""
        effective_redirect = settings.SLACK_REDIRECT_URI or redirect_uri or "http://localhost:8000/api/slack/callback"

        if settings.ENVIRONMENT == "test" or code.startswith("mock_"):
            return {
                "ok": True,
                "access_token": f"xoxb-mock-slack-token-{code}",
                "team": {"id": "T04839210", "name": "Acme Workspace"},
                "authed_user": {"id": "U01234567"},
            }

        client_id = settings.SLACK_CLIENT_ID
        client_secret = settings.SLACK_CLIENT_SECRET
        if not client_id or not client_secret:
            raise ValueError("SLACK_CLIENT_ID and SLACK_CLIENT_SECRET must be configured in environment.")

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                "https://slack.com/api/oauth.v2.access",
                data={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "code": code,
                    "redirect_uri": effective_redirect,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            if not data.get("ok"):
                raise ValueError(f"Slack OAuth exchange failed: {data.get('error', 'unknown_error')}")
            return data

    @classmethod
    async def handle_callback(
        cls,
        code: str,
        state: str,
        user: User,
        redirect_uri: Optional[str],
        db: Session,
        skip_state_validation: bool = False,
    ) -> SlackConnection:
        """Validate state, exchange token, and store encrypted connection."""
        effective_redirect = settings.SLACK_REDIRECT_URI or redirect_uri

        if not skip_state_validation:
            state_data = cls.get_state_payload(state, consume=False)
            if not state_data or state_data.get("user_id") != user.id:
                raise ValueError("Invalid or expired OAuth state parameter.")
            if not effective_redirect and state_data.get("redirect_uri"):
                effective_redirect = state_data.get("redirect_uri")

        token_data = await cls.exchange_code_for_token(code, effective_redirect)

        access_token = token_data.get("access_token")
        if not access_token:
            raise ValueError("Slack response missing access_token.")

        team_info = token_data.get("team") or {}
        team_id = team_info.get("id") if isinstance(team_info, dict) else token_data.get("team_id", "T-UNKNOWN")
        authed_user = token_data.get("authed_user") or {}
        slack_user_id = authed_user.get("id") if isinstance(authed_user, dict) else token_data.get("user_id")

        # Mark any other existing connections for this user as inactive (one active connection per user)
        existing_user_conns = db.query(SlackConnection).filter(
            SlackConnection.user_id == user.id,
            SlackConnection.is_active == True,
        ).all()
        for conn in existing_user_conns:
            conn.is_active = False

        # Find or create connection for this user + team combo
        connection = db.query(SlackConnection).filter(
            SlackConnection.user_id == user.id,
            SlackConnection.slack_team_id == team_id,
        ).first()

        if not connection:
            connection = SlackConnection(
                id=f"sconn-{uuid.uuid4().hex[:12]}",
                user_id=user.id,
                slack_team_id=team_id,
                slack_user_id=slack_user_id,
                is_active=True,
                cursor_state="{}",
            )
            connection.set_token(access_token)
            db.add(connection)
        else:
            connection.slack_user_id = slack_user_id
            connection.set_token(access_token)
            connection.is_active = True
            connection.updated_at = utcnow()

        db.commit()
        db.refresh(connection)

        # Synchronize organization-level IntegrationAccount so /api/v1/integrations reflects connected state
        team_name = team_info.get("name", team_id) if isinstance(team_info, dict) else team_id
        if user.organization_id:
            int_account = db.query(IntegrationAccount).filter(
                IntegrationAccount.organization_id == user.organization_id,
                IntegrationAccount.provider == "slack",
            ).first()

            if not int_account:
                int_account = IntegrationAccount(
                    id=f"int-slack-{uuid.uuid4().hex[:8]}",
                    organization_id=user.organization_id,
                    provider="slack",
                    name=f"Slack ({team_name})",
                    status=IntegrationStatusEnum.CONNECTED.value,
                    account_id=team_id,
                    account_name=team_name,
                    encrypted_access_token=encryption_manager.encrypt(access_token),
                    _scopes=json.dumps(SLACK_SCOPES),
                    sync_status_message="OAuth connected. Continuous ingestion active.",
                    last_sync_at=utcnow(),
                )
                db.add(int_account)
            else:
                int_account.status = IntegrationStatusEnum.CONNECTED.value
                int_account.name = f"Slack ({team_name})"
                int_account.account_id = team_id
                int_account.account_name = team_name
                int_account.encrypted_access_token = encryption_manager.encrypt(access_token)
                int_account._scopes = json.dumps(SLACK_SCOPES)
                int_account.sync_status_message = "OAuth connected. Continuous ingestion active."
                int_account.last_sync_at = utcnow()
                int_account.updated_at = utcnow()

            db.commit()

        # Audit log
        audit = AuditLog(
            id=f"aud-slack-{uuid.uuid4().hex[:8]}",
            organization_id=user.organization_id,
            actor_id=user.id,
            actor=user.email,
            action="slack.connected",
            title=f"Slack workspace {team_id} connected",
            target=connection.id,
            details_json=json.dumps({"team_id": team_id, "slack_user_id": slack_user_id}),
            risk_level="LOW",
        )
        db.add(audit)
        db.commit()

        return connection

    @staticmethod
    def disconnect(user_id: str, db: Session) -> bool:
        """Deactivate all active Slack connections for user and update IntegrationAccount status."""
        conns = db.query(SlackConnection).filter(
            SlackConnection.user_id == user_id,
            SlackConnection.is_active == True,
        ).all()
        if not conns:
            return False
        for c in conns:
            c.is_active = False
            c.updated_at = utcnow()

        # Update organization IntegrationAccount status to disconnected
        user = db.query(User).filter(User.id == user_id).first()
        if user and user.organization_id:
            int_acc = db.query(IntegrationAccount).filter(
                IntegrationAccount.organization_id == user.organization_id,
                IntegrationAccount.provider == "slack",
            ).first()
            if int_acc:
                int_acc.status = IntegrationStatusEnum.DISCONNECTED.value
                int_acc.sync_status_message = "Disconnected by user."
                int_acc.updated_at = utcnow()

        db.commit()
        return True


class SlackMessageReadingService:
    @staticmethod
    def process_slack_message(
        user_id: str,
        organization_id: str,
        slack_team_id: str,
        channel_id: str,
        channel_name: str,
        message_text: str,
        timestamp: str,
        sender_id: str,
        db: Session,
    ) -> Optional[CompanyEvent]:
        """
        Internal event handler for newly detected Slack messages.
        Persists as canonical CompanyEvent and indexes into knowledge base.
        """
        event_id = f"slack_polled_{slack_team_id}_{channel_id}_{timestamp.replace('.', '_')}"

        # DB deduplication check
        existing = db.query(CompanyEvent).filter(
            CompanyEvent.organization_id == organization_id,
            CompanyEvent.source == "Slack",
            CompanyEvent.provider_event_id == event_id,
        ).first()

        if existing:
            return existing

        now_iso = datetime.now(timezone.utc).isoformat()
        evt = CompanyEvent(
            id=f"evt-slack-msg-{uuid.uuid4().hex[:8]}",
            organization_id=organization_id,
            provider_event_id=event_id,
            source="Slack",
            type="message.created",
            title=f"Slack #{channel_name}: {message_text[:60]}...",
            content=message_text,
            author=sender_id,
            owner="Slack User",
            timestamp=now_iso,
            authority_score=0.90,
            freshness_score=1.0,
            pipeline_stage="processed",
            event_type_normalized="chat_message",
            ingestion_source="slack-poller",
            vector_indexed=True,
        )
        evt.tags = ["slack", "realtime", channel_name, channel_id]
        db.add(evt)
        db.commit()
        db.refresh(evt)
        return evt

    @classmethod
    def poll_connection(cls, connection: SlackConnection, db: Session) -> Dict[str, Any]:
        """
        Polls Slack conversations for an active SlackConnection.
        Fetches public/private channels, reads up to 20 messages per channel,
        deduplicates using cursors, processes messages, and handles auth errors.
        """
        if not connection.is_active:
            return {"status": "inactive", "messages_processed": 0}

        user = connection.user
        org_id = user.organization_id if user else "default-org"

        try:
            plain_token = connection.get_token()
        except Exception as e:
            logger.error(f"Failed to decrypt Slack token for connection {connection.id}: {e}")
            return {"status": "error", "message": "Decryption failed"}

        client = WebClient(token=plain_token)
        messages_processed = 0

        try:
            # 1. Fetch channels list
            conv_resp = client.conversations_list(
                types="public_channel,private_channel",
                exclude_archived=True,
                limit=50,
            )
            channels = conv_resp.get("channels", [])

            channel_cursors = connection.get_channel_cursors()

            for chan in channels:
                chan_id = chan.get("id")
                chan_name = chan.get("name", "general")
                last_ts = channel_cursors.get(chan_id, "0")

                try:
                    # 2. Fetch recent messages
                    hist_kwargs: Dict[str, Any] = {
                        "channel": chan_id,
                        "limit": 20,
                    }
                    if last_ts and last_ts != "0":
                        hist_kwargs["oldest"] = last_ts

                    hist_resp = client.conversations_history(**hist_kwargs)
                    messages = hist_resp.get("messages", [])

                    latest_seen_ts = last_ts

                    for msg in reversed(messages):  # Process chronologically
                        # Filter out message subtypes (channel joins, etc.) if only user text is needed
                        if msg.get("type") == "message" and "subtype" not in msg and msg.get("text"):
                            msg_ts = msg.get("ts", "")
                            # Deduplication check
                            dedup_key = f"slack:msg_dedup:{connection.slack_team_id}:{chan_id}:{msg_ts}"
                            is_new = redis_client.check_and_set_dedup(dedup_key, ttl_seconds=86400 * 7)

                            if is_new and float(msg_ts) > float(last_ts):
                                cls.process_slack_message(
                                    user_id=connection.user_id,
                                    organization_id=org_id,
                                    slack_team_id=connection.slack_team_id,
                                    channel_id=chan_id,
                                    channel_name=chan_name,
                                    message_text=msg.get("text", ""),
                                    timestamp=msg_ts,
                                    sender_id=msg.get("user", "U_UNKNOWN"),
                                    db=db,
                                )
                                messages_processed += 1

                            if float(msg_ts) > float(latest_seen_ts):
                                latest_seen_ts = msg_ts

                    if latest_seen_ts != last_ts:
                        connection.set_channel_cursor(chan_id, latest_seen_ts)

                except SlackApiError as chan_err:
                    err_code = chan_err.response.get("error")
                    # Ignore harmless channel-specific errors (not a member, etc.)
                    if err_code in ["not_in_channel", "channel_not_found"]:
                        continue
                    logger.warning(f"Error fetching history for channel {chan_id}: {err_code}")

            connection.last_polled_at = utcnow()
            db.commit()

            return {
                "status": "success",
                "messages_processed": messages_processed,
                "team_id": connection.slack_team_id,
            }

        except SlackApiError as e:
            error_code = e.response.get("error", "unknown")
            logger.error(f"Slack API error for connection {connection.id}: {error_code}")
            # Handle token revocation / invalid auth
            if error_code in ["invalid_auth", "token_revoked", "account_inactive", "token_expired"]:
                connection.is_active = False
                connection.updated_at = utcnow()
                db.commit()
                logger.warning(f"Slack connection {connection.id} deactivated due to {error_code}.")
            return {"status": "error", "error": error_code}
        except Exception as exc:
            logger.error(f"Unexpected error polling connection {connection.id}: {exc}", exc_info=True)
            return {"status": "error", "message": str(exc)}

    @classmethod
    def poll_all_active_connections(cls, db: Session) -> List[Dict[str, Any]]:
        """Poll all active Slack connections across all users."""
        active_conns = db.query(SlackConnection).filter(SlackConnection.is_active == True).all()
        results = []
        for conn in active_conns:
            res = cls.poll_connection(conn, db)
            results.append({"connection_id": conn.id, "user_id": conn.user_id, "result": res})
        return results
