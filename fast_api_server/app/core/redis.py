import logging
from typing import Optional, Dict, Any
import redis
from app.core.config import settings

logger = logging.getLogger(__name__)


class RedisClient:
    def __init__(self):
        self._client: Optional[redis.Redis] = None
        self._in_memory_fallback: Dict[str, Any] = {}

    def get_client(self) -> redis.Redis:
        if self._client is None:
            try:
                pool = redis.ConnectionPool.from_url(
                    settings.REDIS_URL,
                    max_connections=settings.REDIS_MAX_CONNECTIONS,
                    socket_timeout=settings.REDIS_TIMEOUT_SECONDS,
                    decode_responses=True,
                )
                self._client = redis.Redis(connection_pool=pool)
            except Exception as e:
                logger.warning(f"Failed to initialize Redis connection pool: {e}")
                # Create default client
                self._client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        return self._client

    def ping(self) -> bool:
        try:
            client = self.get_client()
            return bool(client.ping())
        except Exception as e:
            logger.debug(f"Redis ping failed: {e}")
            return False

    def set_with_ttl(self, key: str, value: str, ttl_seconds: int) -> bool:
        try:
            client = self.get_client()
            client.setex(key, ttl_seconds, value)
            return True
        except Exception as e:
            logger.warning(f"Redis set_with_ttl error for {key}: {e}. Using in-memory fallback.")
            self._in_memory_fallback[key] = value
            return True

    def get(self, key: str) -> Optional[str]:
        try:
            client = self.get_client()
            val = client.get(key)
            if val is not None:
                return str(val)
            return self._in_memory_fallback.get(key)
        except Exception as e:
            logger.warning(f"Redis get error for {key}: {e}. Checking in-memory fallback.")
            return self._in_memory_fallback.get(key)

    def delete(self, key: str) -> bool:
        try:
            client = self.get_client()
            client.delete(key)
            self._in_memory_fallback.pop(key, None)
            return True
        except Exception as e:
            logger.warning(f"Redis delete error for {key}: {e}")
            self._in_memory_fallback.pop(key, None)
            return True

    def check_and_set_dedup(self, key: str, ttl_seconds: int = 86400) -> bool:
        """
        Fast-path webhook dedup guard using SETNX.
        Returns True if the key was freshly set (not duplicate).
        Returns False if the key already exists (is duplicate).
        """
        try:
            client = self.get_client()
            # SET key value NX EX ttl
            is_new = client.set(key, "1", nx=True, ex=ttl_seconds)
            return bool(is_new)
        except Exception as e:
            logger.warning(f"Redis check_and_set_dedup error for {key}: {e}. Using fallback.")
            if key in self._in_memory_fallback:
                return False
            self._in_memory_fallback[key] = "1"
            return True

    def rate_limit_check(self, identifier: str, limit: int, window_seconds: int = 60) -> tuple[bool, int]:
        """
        Sliding counter rate limiter.
        Returns (is_allowed, remaining_calls).
        """
        key = f"ratelimit:{identifier}"
        try:
            client = self.get_client()
            pipeline = client.pipeline()
            pipeline.incr(key)
            pipeline.ttl(key)
            results = pipeline.execute()
            count = results[0]
            ttl = results[1]
            if count == 1 or ttl == -1:
                client.expire(key, window_seconds)
            
            remaining = max(0, limit - count)
            return (count <= limit, remaining)
        except Exception as e:
            logger.debug(f"Redis rate_limit error: {e}. Permitting request.")
            return (True, limit)


redis_client = RedisClient()
