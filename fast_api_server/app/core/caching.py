"""
app/core/caching.py
===================
Two-tier network response caching subsystem for Company Brain OS.

Tier 1 (L1):  In-process LRU + TTL dict cache  (<0.1 ms per hit)
Tier 2 (L2):  Distributed Redis cache           (<1–2 ms per hit)

Design principles:
- All cache keys are tenant-isolated: ``cb:cache:{org_id}:{route}:{params_hash}``
- Mutations MUST call ``cache_manager.invalidate_tenant(org_id, resource_tag)``
  so that stale reads never cross write boundaries.
- If Redis is unavailable the layer silently degrades to L1-only mode.
- Responses are serialized to JSON bytes so they survive across processes.
"""

import hashlib
import json
import logging
import time
from collections import OrderedDict
from threading import Lock
from typing import Any, Optional

from app.core.redis import redis_client

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# L1 — In-Process LRU + TTL Cache
# ---------------------------------------------------------------------------

class _L1Entry:
    __slots__ = ("value", "expires_at")

    def __init__(self, value: Any, ttl: int) -> None:
        self.value = value
        self.expires_at = time.monotonic() + ttl


class L1Cache:
    """
    Thread-safe in-process LRU cache with per-entry TTL eviction.

    Capacity defaults to 512 entries — configurable at construction time.
    Least-recently-used entries are evicted once the cache is full.
    """

    def __init__(self, capacity: int = 512) -> None:
        self._capacity = capacity
        self._store: OrderedDict[str, _L1Entry] = OrderedDict()
        self._lock = Lock()

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            if time.monotonic() > entry.expires_at:
                del self._store[key]
                return None
            # Move to end (most-recently used)
            self._store.move_to_end(key)
            return entry.value

    def set(self, key: str, value: Any, ttl: int) -> None:
        with self._lock:
            if key in self._store:
                self._store.move_to_end(key)
            self._store[key] = _L1Entry(value, ttl)
            if len(self._store) > self._capacity:
                # Evict LRU entry
                self._store.popitem(last=False)

    def delete(self, key: str) -> None:
        with self._lock:
            self._store.pop(key, None)

    def delete_prefix(self, prefix: str) -> int:
        """Evict all keys that start with ``prefix``. Returns count evicted."""
        with self._lock:
            keys = [k for k in self._store if k.startswith(prefix)]
            for k in keys:
                del self._store[k]
            return len(keys)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()

    @property
    def size(self) -> int:
        return len(self._store)


# ---------------------------------------------------------------------------
# CacheManager — Orchestrates L1 + L2
# ---------------------------------------------------------------------------

class CacheManager:
    """
    Unified two-tier cache manager.

    Usage — reading::

        value = cache_manager.get("cb:cache:org-1:documents:", is_json=True)

    Usage — writing::

        cache_manager.set("cb:cache:org-1:documents:", data, ttl=60)

    Usage — invalidation after a mutation::

        cache_manager.invalidate_tenant(org_id="org-1", resource_tag="documents")
    """

    # Redis TTL is always slightly longer than L1 so L2 can repopulate L1.
    _L2_TTL_PADDING = 10  # seconds

    def __init__(self) -> None:
        self._l1 = L1Cache(capacity=512)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get(self, key: str, *, is_json: bool = True) -> Optional[Any]:
        """Return a cached value or ``None`` on miss."""
        # 1. L1 hit
        val = self._l1.get(key)
        if val is not None:
            return val

        # 2. L2 hit
        raw = redis_client.get(key)
        if raw is not None:
            try:
                val = json.loads(raw) if is_json else raw
                # Backfill L1 with a short TTL so repeated in-request reads
                # don't need to hit Redis again.
                self._l1.set(key, val, ttl=30)
                return val
            except (json.JSONDecodeError, Exception) as exc:
                logger.debug("CacheManager.get deserialize error for %s: %s", key, exc)
                return None

        return None

    def set(self, key: str, value: Any, ttl: int, *, is_json: bool = True) -> None:
        """Store ``value`` in both L1 and L2."""
        # L1
        self._l1.set(key, value, ttl=ttl)

        # L2 — serialize to string
        try:
            raw = json.dumps(value, default=str) if is_json else str(value)
            redis_client.set_with_ttl(key, raw, ttl_seconds=ttl + self._L2_TTL_PADDING)
        except Exception as exc:
            logger.debug("CacheManager.set Redis error for %s: %s", key, exc)

    def delete(self, key: str) -> None:
        """Evict a single key from both tiers."""
        self._l1.delete(key)
        try:
            redis_client.delete(key)
        except Exception as exc:
            logger.debug("CacheManager.delete Redis error for %s: %s", key, exc)

    def invalidate_tenant(self, org_id: str, resource_tag: str) -> int:
        """
        Evict all cached entries for a given tenant + resource tag.

        Cache keys follow the convention::

            cb:cache:{org_id}:{resource_tag}*

        Returns the total number of L1 entries evicted.
        """
        prefix = _build_prefix(org_id, resource_tag)
        evicted = self._l1.delete_prefix(prefix)
        logger.debug(
            "CacheManager.invalidate_tenant: prefix=%s, l1_evicted=%d",
            prefix,
            evicted,
        )
        # Redis pattern delete: use SCAN to avoid blocking the server.
        try:
            client = redis_client.get_client()
            cursor = 0
            redis_evicted = 0
            while True:
                cursor, keys = client.scan(cursor, match=f"{prefix}*", count=100)
                if keys:
                    client.delete(*keys)
                    redis_evicted += len(keys)
                if cursor == 0:
                    break
            logger.debug(
                "CacheManager.invalidate_tenant: redis_evicted=%d", redis_evicted
            )
        except Exception as exc:
            logger.debug("CacheManager.invalidate_tenant Redis error: %s", exc)

        return evicted

    def invalidate_all_tenant(self, org_id: str) -> None:
        """Evict ALL cached data for an entire tenant."""
        prefix = f"cb:cache:{org_id}:"
        self._l1.delete_prefix(prefix)
        try:
            client = redis_client.get_client()
            cursor = 0
            while True:
                cursor, keys = client.scan(cursor, match=f"{prefix}*", count=100)
                if keys:
                    client.delete(*keys)
                if cursor == 0:
                    break
        except Exception as exc:
            logger.debug("CacheManager.invalidate_all_tenant Redis error: %s", exc)

    @property
    def l1(self) -> L1Cache:
        return self._l1


# ---------------------------------------------------------------------------
# Cache-Key Helpers
# ---------------------------------------------------------------------------

def _build_prefix(org_id: str, resource_tag: str) -> str:
    return f"cb:cache:{org_id}:{resource_tag}:"


def build_cache_key(
    org_id: str,
    resource_tag: str,
    *,
    extra: Optional[str] = None,
) -> str:
    """
    Build a fully-qualified, tenant-scoped cache key.

    ``extra`` can be any string differentiating variants (e.g. query params,
    filters) and will be hashed to a short 8-character hex fingerprint so keys
    remain safe for Redis and predictable in length.

    Example::

        build_cache_key("org-1", "documents", extra="status=open")
        # → "cb:cache:org-1:documents:a1b2c3d4"
    """
    prefix = _build_prefix(org_id, resource_tag)
    if extra:
        fingerprint = hashlib.md5(extra.encode(), usedforsecurity=False).hexdigest()[:8]
        return f"{prefix}{fingerprint}"
    return f"{prefix}all"


# ---------------------------------------------------------------------------
# Singleton Instance
# ---------------------------------------------------------------------------

cache_manager = CacheManager()
