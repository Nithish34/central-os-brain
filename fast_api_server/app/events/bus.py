import logging
import json
import time
from typing import List, Dict, Any, Optional
import redis
from redis.exceptions import ResponseError, ConnectionError

from app.core.config import settings
from app.core.redis import redis_client
from app.events.schemas import CanonicalEvent, StreamEventEnvelope

logger = logging.getLogger(__name__)

EVENTS_STREAM = "company_brain:events"
EVENTS_DLQ_STREAM = "company_brain:events:dlq"
DEFAULT_CONSUMER_GROUPS = ["knowledge-workers", "workflow-workers", "audit-workers"]


class InMemoryStream:
    """In-memory simulation of Redis Streams for standalone/offline testing."""
    def __init__(self):
        self.messages: List[Dict[str, Any]] = []  # [{id, fields}]
        self.groups: Dict[str, Dict[str, Any]] = {}  # group_name -> {last_id, pending: {id: (consumer, timestamp)}}
        self._seq = 0

    def add(self, fields: Dict[str, Any]) -> str:
        self._seq += 1
        stream_id = f"{int(time.time() * 1000)}-{self._seq}"
        self.messages.append({"id": stream_id, "fields": fields})
        return stream_id

    def create_group(self, group_name: str):
        if group_name not in self.groups:
            self.groups[group_name] = {"last_idx": 0, "pending": {}}

    def read_group(self, group_name: str, consumer_name: str, count: int = 10) -> List[tuple]:
        self.create_group(group_name)
        grp = self.groups[group_name]
        start_idx = grp["last_idx"]
        available = self.messages[start_idx : start_idx + count]
        grp["last_idx"] = start_idx + len(available)

        results = []
        for msg in available:
            grp["pending"][msg["id"]] = (consumer_name, time.time())
            results.append((msg["id"], msg["fields"]))
        return results

    def ack(self, group_name: str, stream_id: str) -> int:
        if group_name in self.groups and stream_id in self.groups[group_name]["pending"]:
            del self.groups[group_name]["pending"][stream_id]
            return 1
        return 0

    def pending_count(self, group_name: str) -> int:
        if group_name in self.groups:
            return len(self.groups[group_name]["pending"])
        return 0


class RedisEventBus:
    """
    Redis Streams transport bus for Company Brain OS canonical events.
    Supports independent consumer groups, at-least-once delivery, late ACK, and DLQ streams.
    """
    _in_memory_streams: Dict[str, InMemoryStream] = {}

    @classmethod
    def reset_in_memory(cls):
        """Clears all in-memory streams between test runs."""
        cls._in_memory_streams.clear()

    def __init__(self, client: Optional[redis.Redis] = None):
        self._client = client

    def _get_client(self) -> redis.Redis:
        if self._client is not None:
            return self._client
        return redis_client.get_client()

    def _get_in_memory_stream(self, stream_name: str) -> InMemoryStream:
        if stream_name not in self._in_memory_streams:
            self._in_memory_streams[stream_name] = InMemoryStream()
        return self._in_memory_streams[stream_name]

    def _use_in_memory(self) -> bool:
        if self._client is not None:
            return False
        if settings.ENVIRONMENT == "test":
            return True
        return not redis_client.ping()

    def ensure_consumer_groups(
        self,
        stream_name: str = EVENTS_STREAM,
        groups: Optional[List[str]] = None,
    ) -> None:
        """
        Idempotently initializes consumer groups with MKSTREAM.
        """
        target_groups = groups or DEFAULT_CONSUMER_GROUPS
        if self._use_in_memory():
            mem_stream = self._get_in_memory_stream(stream_name)
            for grp in target_groups:
                mem_stream.create_group(grp)
            return

        try:
            client = self._get_client()
            for grp in target_groups:
                try:
                    client.xgroup_create(name=stream_name, groupname=grp, id="0", mkstream=True)
                    logger.info(f"[RedisEventBus] Created consumer group '{grp}' on stream '{stream_name}'")
                except ResponseError as re:
                    if "BUSYGROUP" in str(re):
                        pass  # Group already exists
                    else:
                        raise re
        except Exception as e:
            logger.warning(f"[RedisEventBus] Redis connection error during ensure_consumer_groups: {e}. Using in-memory fallback.")
            mem_stream = self._get_in_memory_stream(stream_name)
            for grp in target_groups:
                mem_stream.create_group(grp)

    def publish(
        self,
        event: CanonicalEvent,
        outbox_id: str,
        run_id: str = "run_live_001",
        stream_name: str = EVENTS_STREAM,
    ) -> str:
        """
        Publishes canonical event envelope to Redis Stream via XADD.
        """
        fields = {
            "event_id": event.event_id,
            "outbox_id": outbox_id,
            "run_id": run_id,
            "organization_id": event.organization_id,
            "provider": event.provider,
            "event_type": event.event_type,
            "payload": event.model_dump_json(),
        }
        if self._use_in_memory():
            mem_stream = self._get_in_memory_stream(stream_name)
            return mem_stream.add(fields)

        try:
            client = self._get_client()
            stream_id = client.xadd(
                name=stream_name,
                fields=fields,
                maxlen=100000,
                approximate=True,
            )
            return str(stream_id)
        except Exception as e:
            logger.warning(f"[RedisEventBus] Failed to publish via Redis ({e}). Using in-memory stream fallback.")
            mem_stream = self._get_in_memory_stream(stream_name)
            return mem_stream.add(fields)

    def publish_raw(
        self,
        fields: Dict[str, Any],
        stream_name: str = EVENTS_STREAM,
    ) -> str:
        """Publishes arbitrary fields dict to stream."""
        if self._use_in_memory():
            mem_stream = self._get_in_memory_stream(stream_name)
            return mem_stream.add(fields)

        try:
            client = self._get_client()
            stream_id = client.xadd(
                name=stream_name,
                fields=fields,
                maxlen=100000,
                approximate=True,
            )
            return str(stream_id)
        except Exception as e:
            logger.warning(f"[RedisEventBus] Failed to publish_raw via Redis ({e}). Using in-memory stream fallback.")
            mem_stream = self._get_in_memory_stream(stream_name)
            return mem_stream.add(fields)

    def read_group(
        self,
        group_name: str,
        consumer_name: str,
        count: int = 10,
        block_ms: int = 1000,
        stream_name: str = EVENTS_STREAM,
    ) -> List[StreamEventEnvelope]:
        """
        Reads next unassigned messages from stream for specified consumer group (XREADGROUP).
        """
        if self._use_in_memory():
            mem_stream = self._get_in_memory_stream(stream_name)
            messages = mem_stream.read_group(group_name, consumer_name, count)
            envelopes = []
            for msg_id, raw_fields in messages:
                env = self._parse_message(msg_id, raw_fields)
                if env:
                    envelopes.append(env)
            return envelopes

        try:
            client = self._get_client()
            resp = client.xreadgroup(
                groupname=group_name,
                consumername=consumer_name,
                streams={stream_name: ">"},
                count=count,
                block=block_ms,
            )
            if not resp:
                return []

            envelopes: List[StreamEventEnvelope] = []
            for stream_key, messages in resp:
                for msg_id, raw_fields in messages:
                    env = self._parse_message(msg_id, raw_fields)
                    if env:
                        envelopes.append(env)
            return envelopes
        except Exception as e:
            logger.debug(f"[RedisEventBus] Reading from in-memory stream fallback for group {group_name}: {e}")
            mem_stream = self._get_in_memory_stream(stream_name)
            messages = mem_stream.read_group(group_name, consumer_name, count)
            envelopes = []
            for msg_id, raw_fields in messages:
                env = self._parse_message(msg_id, raw_fields)
                if env:
                    envelopes.append(env)
            return envelopes

    def ack(
        self,
        group_name: str,
        stream_id: str,
        stream_name: str = EVENTS_STREAM,
    ) -> int:
        """
        Acknowledges message processing completion (XACK).
        """
        if self._use_in_memory():
            mem_stream = self._get_in_memory_stream(stream_name)
            return mem_stream.ack(group_name, stream_id)

        try:
            client = self._get_client()
            return int(client.xack(stream_name, group_name, stream_id))
        except Exception as e:
            logger.debug(f"[RedisEventBus] Acking in-memory stream fallback: {e}")
            mem_stream = self._get_in_memory_stream(stream_name)
            return mem_stream.ack(group_name, stream_id)

    def get_pending_count(
        self,
        group_name: str,
        stream_name: str = EVENTS_STREAM,
    ) -> int:
        """
        Retrieves current pending message count for consumer group.
        """
        if self._use_in_memory():
            mem_stream = self._get_in_memory_stream(stream_name)
            return mem_stream.pending_count(group_name)

        try:
            client = self._get_client()
            pending_info = client.xpending(stream_name, group_name)
            if isinstance(pending_info, dict):
                return pending_info.get("pending", 0)
            elif isinstance(pending_info, (list, tuple)) and len(pending_info) > 0:
                return pending_info[0]
            return 0
        except Exception:
            mem_stream = self._get_in_memory_stream(stream_name)
            return mem_stream.pending_count(group_name)

    def _parse_message(self, msg_id: str, raw_fields: Dict[str, Any]) -> Optional[StreamEventEnvelope]:
        try:
            payload_str = raw_fields.get("payload", "{}")
            canonical_dict = json.loads(payload_str)
            canonical = CanonicalEvent(**canonical_dict)

            return StreamEventEnvelope(
                stream_id=str(msg_id),
                event_id=raw_fields.get("event_id", canonical.event_id),
                outbox_id=raw_fields.get("outbox_id", ""),
                run_id=raw_fields.get("run_id", "run_live_001"),
                canonical_event=canonical,
                raw_payload=raw_fields,
            )
        except Exception as e:
            logger.error(f"[RedisEventBus] Failed to parse message {msg_id}: {e}")
            return None


event_bus = RedisEventBus()
