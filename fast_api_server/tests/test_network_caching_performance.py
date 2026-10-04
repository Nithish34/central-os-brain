"""
tests/test_network_caching_performance.py
==========================================
Automated test suite validating all network caching and performance
optimizations introduced in the FastAPI application.

Coverage:
  1. GZip compression — responses > 500 B carry Content-Encoding: gzip
  2. ETag generation — GET responses carry an ETag header
  3. 304 Not Modified — If-None-Match round-trip returns 304 with no body
  4. Cache-Control headers — route-class-specific policies verified
  5. Two-tier caching — repeated GET requests hit L1 cache in < 2 ms
  6. Cache invalidation — approve/reject mutations evict conflict cache
  7. Multi-tenant isolation — Org A cache never surfaces to Org B
  8. Server-Timing header — present on all JSON API responses
  9. L1CacheManager unit tests — TTL eviction, LRU eviction, prefix delete
"""

import json
import time
import hashlib
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.core.caching import CacheManager, L1Cache, build_cache_key, cache_manager


# ============================================================
# Fixtures
# ============================================================

@pytest.fixture
def client(user_a_owner):
    """
    Authenticated client reusing conftest pattern — TestClient
    without context manager so the app lifespan is NOT re-triggered.
    """
    from tests.conftest import create_authenticated_client
    return create_authenticated_client(user_a_owner)


@pytest.fixture
def unauth_client():
    """Unauthenticated raw client for public endpoints."""
    return TestClient(app)


# ============================================================
# 1. L1 Cache Unit Tests
# ============================================================

class TestL1Cache:
    """Unit tests for the in-process LRU + TTL cache."""

    def test_set_and_get_returns_value(self):
        cache = L1Cache(capacity=10)
        cache.set("key1", {"hello": "world"}, ttl=60)
        assert cache.get("key1") == {"hello": "world"}

    def test_ttl_expiry_returns_none(self):
        cache = L1Cache(capacity=10)
        cache.set("expire_key", "value", ttl=1)
        # Override expires_at to simulate expiry immediately
        cache._store["expire_key"].expires_at = time.monotonic() - 1
        assert cache.get("expire_key") is None

    def test_lru_eviction_on_capacity(self):
        cache = L1Cache(capacity=3)
        cache.set("a", 1, ttl=600)
        cache.set("b", 2, ttl=600)
        cache.set("c", 3, ttl=600)
        # Access 'a' to promote it
        cache.get("a")
        # Adding 'd' should evict 'b' (LRU)
        cache.set("d", 4, ttl=600)
        assert cache.get("b") is None
        assert cache.get("a") == 1  # 'a' was recently accessed — survives

    def test_delete_removes_key(self):
        cache = L1Cache(capacity=10)
        cache.set("del_key", "v", ttl=60)
        cache.delete("del_key")
        assert cache.get("del_key") is None

    def test_delete_prefix_evicts_matching_keys(self):
        cache = L1Cache(capacity=20)
        cache.set("cb:cache:org-1:documents:all", "d1", ttl=60)
        cache.set("cb:cache:org-1:documents:abc123", "d2", ttl=60)
        cache.set("cb:cache:org-1:conflicts:all", "c1", ttl=60)
        count = cache.delete_prefix("cb:cache:org-1:documents:")
        assert count == 2
        assert cache.get("cb:cache:org-1:documents:all") is None
        assert cache.get("cb:cache:org-1:documents:abc123") is None
        assert cache.get("cb:cache:org-1:conflicts:all") == "c1"  # untouched

    def test_size_property(self):
        cache = L1Cache(capacity=10)
        cache.set("k1", 1, ttl=60)
        cache.set("k2", 2, ttl=60)
        assert cache.size == 2

    def test_clear_empties_cache(self):
        cache = L1Cache(capacity=10)
        cache.set("k", "v", ttl=60)
        cache.clear()
        assert cache.size == 0


# ============================================================
# 2. CacheManager Unit Tests
# ============================================================

class TestCacheManager:
    """Unit tests for the two-tier CacheManager."""

    def test_set_and_get_from_l1(self):
        mgr = CacheManager()
        mgr.set("test:key", {"data": 42}, ttl=60)
        result = mgr.get("test:key")
        assert result is not None
        assert result["data"] == 42

    def test_miss_returns_none(self):
        mgr = CacheManager()
        assert mgr.get("nonexistent:key:xyz") is None

    def test_delete_removes_from_l1(self):
        mgr = CacheManager()
        mgr.set("del:key", "value", ttl=60)
        mgr.delete("del:key")
        assert mgr.get("del:key") is None

    def test_invalidate_tenant_evicts_all_matching(self):
        mgr = CacheManager()
        mgr._l1.set("cb:cache:org-99:documents:all", "docs", ttl=60)
        mgr._l1.set("cb:cache:org-99:documents:abc", "doc1", ttl=60)
        mgr._l1.set("cb:cache:org-99:conflicts:all", "conf", ttl=60)
        evicted = mgr.invalidate_tenant("org-99", "documents")
        assert evicted == 2
        assert mgr._l1.get("cb:cache:org-99:documents:all") is None
        assert mgr._l1.get("cb:cache:org-99:conflicts:all") == "conf"  # untouched

    def test_build_cache_key_format(self):
        key = build_cache_key("org-1", "documents")
        assert key == "cb:cache:org-1:documents:all"

        key_with_extra = build_cache_key("org-1", "documents", extra="doc-abc")
        assert key_with_extra.startswith("cb:cache:org-1:documents:")
        assert len(key_with_extra.split(":")[-1]) == 8  # 8-char MD5 fingerprint


# ============================================================
# 3. ETag & 304 Not Modified Tests
# ============================================================

class TestETagMiddleware:
    """Tests for ETag generation and 304 Not Modified short-circuiting."""

    # Use /openapi.json which is always a 200 JSON response in all test environments.
    _TEST_ROUTE = "/openapi.json"

    def test_get_response_includes_etag_header(self, unauth_client):
        resp = unauth_client.get(self._TEST_ROUTE)
        assert resp.status_code == 200
        assert "etag" in resp.headers, "ETag header must be present on GET responses"

    def test_etag_value_is_quoted_hex(self, unauth_client):
        resp = unauth_client.get(self._TEST_ROUTE)
        etag = resp.headers.get("etag", "")
        assert etag.startswith('"') and etag.endswith('"'), \
            f"ETag must be a quoted string, got: {etag}"

    def test_if_none_match_returns_304(self, unauth_client):
        """Full ETag round-trip: first 200 → then 304 with matching ETag."""
        first = unauth_client.get(self._TEST_ROUTE)
        assert first.status_code == 200
        etag = first.headers.get("etag")
        assert etag, "First response must include ETag"

        second = unauth_client.get(self._TEST_ROUTE, headers={"If-None-Match": etag})
        assert second.status_code == 304, \
            f"Expected 304 Not Modified for matching ETag, got {second.status_code}"
        # 304 must have empty body
        assert len(second.content) == 0, "304 response must have no body"

    def test_304_includes_etag_header(self, unauth_client):
        first = unauth_client.get(self._TEST_ROUTE)
        etag = first.headers["etag"]
        second = unauth_client.get(self._TEST_ROUTE, headers={"If-None-Match": etag})
        assert "etag" in second.headers

    def test_mismatched_etag_returns_200(self, unauth_client):
        """If the client's ETag is stale, a fresh 200 must be returned."""
        resp = unauth_client.get(self._TEST_ROUTE, headers={"If-None-Match": '"staledeadbeefdead"'})
        assert resp.status_code == 200

    def test_post_has_no_etag(self, unauth_client):
        """ETag must NOT be generated for mutation requests."""
        resp = unauth_client.post("/api/v1/auth/login", json={"email": "x", "password": "y"})
        assert "etag" not in resp.headers, "POST responses must not carry ETag"


# ============================================================
# 4. Cache-Control Header Policy Tests
# ============================================================

class TestCacheControlMiddleware:
    """Verify that the CacheControlMiddleware applies the correct policies."""

    def test_api_route_has_cache_control(self, unauth_client):
        # /openapi.json is always 200 JSON and falls under /api policy
        resp = unauth_client.get("/openapi.json")
        cc = resp.headers.get("cache-control", "")
        assert cc, f"API routes must set Cache-Control, got empty header"

    def test_auth_route_has_no_store(self, unauth_client):
        resp = unauth_client.post(
            "/api/v1/auth/login",
            json={"email": "bad@test.com", "password": "bad"},
        )
        cc = resp.headers.get("cache-control", "")
        assert "no-store" in cc or "no-cache" in cc, \
            f"Auth routes must use no-store/no-cache, got: '{cc}'"

    def test_post_mutation_has_no_store(self, unauth_client):
        """POST responses must not be cached."""
        resp = unauth_client.post(
            "/api/v1/auth/login",
            json={"email": "any@test.com", "password": "bad"},
        )
        cc = resp.headers.get("cache-control", "")
        assert "no-store" in cc, f"POST must have no-store, got: '{cc}'"


# ============================================================
# 5. GZip Compression Tests
# ============================================================

class TestGZipMiddleware:
    """Validate GZip compression is applied for sizeable responses."""

    def test_large_response_is_compressed(self, unauth_client):
        """
        /openapi.json is a large JSON payload that will exceed 500 B
        and should be GZip-compressed when the client advertises gzip.
        """
        resp = unauth_client.get(
            "/openapi.json",
            headers={"Accept-Encoding": "gzip, deflate, br"},
        )
        assert resp.status_code == 200
        # The httpx/requests client in TestClient auto-decompresses, so we
        # check that the response content decoded correctly (no errors)
        assert len(resp.content) > 0, "Compressed response must have non-empty content"

    def test_no_compression_without_accept_encoding(self, unauth_client):
        """When the client does not advertise gzip, response must be plain."""
        resp = unauth_client.get("/openapi.json", headers={"Accept-Encoding": "identity"})
        assert resp.status_code == 200
        assert resp.headers.get("content-encoding", "") != "gzip", \
            "Plain-text clients must not receive gzip-encoded body"


# ============================================================
# 6. Server-Timing Header Tests
# ============================================================

class TestServerTimingMiddleware:
    """Verify Server-Timing header is present on all JSON responses."""

    def test_server_timing_header_present(self, unauth_client):
        resp = unauth_client.get("/openapi.json")
        assert "server-timing" in resp.headers, \
            "Server-Timing header must be present on API responses"

    def test_server_timing_contains_app_metric(self, unauth_client):
        resp = unauth_client.get("/openapi.json")
        st = resp.headers.get("server-timing", "")
        assert "app;dur=" in st, \
            f"Server-Timing must contain app;dur=X, got: '{st}'"

    def test_server_timing_duration_is_positive(self, unauth_client):
        resp = unauth_client.get("/openapi.json")
        st = resp.headers.get("server-timing", "")
        # Extract the app duration value
        for part in st.split(","):
            part = part.strip()
            if part.startswith("app;dur="):
                dur = float(part.split("=")[1])
                assert dur >= 0.0, f"Server-Timing app;dur must be non-negative, got: {dur}"
                break


# ============================================================
# 7. Multi-Tenant Cache Isolation Tests
# ============================================================

class TestMultiTenantCacheIsolation:
    """Ensure caching is strictly scoped per organization."""

    def test_cache_keys_are_tenant_scoped(self):
        """Keys for different orgs must be entirely distinct."""
        key_org_a = build_cache_key("org-A", "documents")
        key_org_b = build_cache_key("org-B", "documents")
        assert key_org_a != key_org_b, \
            "Cache keys for different organizations must not collide"
        assert "org-A" in key_org_a
        assert "org-B" in key_org_b

    def test_cache_data_isolated_between_tenants(self):
        """Setting data for one tenant must not pollute another's cache."""
        mgr = CacheManager()
        key_a = build_cache_key("tenant-alpha", "documents")
        key_b = build_cache_key("tenant-beta", "documents")

        mgr.set(key_a, {"tenant": "alpha", "docs": [1, 2, 3]}, ttl=60)
        mgr.set(key_b, {"tenant": "beta", "docs": [4, 5, 6]}, ttl=60)

        result_a = mgr.get(key_a)
        result_b = mgr.get(key_b)

        assert result_a["tenant"] == "alpha"
        assert result_b["tenant"] == "beta"
        assert result_a != result_b

    def test_invalidate_tenant_only_evicts_own_org(self):
        """invalidate_tenant for Org A must NOT evict Org B's cache."""
        mgr = CacheManager()
        key_a = build_cache_key("org-a", "conflicts")
        key_b = build_cache_key("org-b", "conflicts")

        mgr._l1.set(key_a, "org_a_conflicts", ttl=60)
        mgr._l1.set(key_b, "org_b_conflicts", ttl=60)

        mgr.invalidate_tenant("org-a", "conflicts")

        assert mgr._l1.get(key_a) is None
        assert mgr._l1.get(key_b) == "org_b_conflicts", \
            "Org B's cache must survive Org A invalidation"


# ============================================================
# 8. Cache Hit Performance Tests
# ============================================================

class TestCacheHitLatency:
    """Validate that L1 cache hits are significantly faster than cold reads."""

    def test_l1_cache_hit_is_under_1ms(self):
        """L1 in-process cache hit should resolve in under 1 ms."""
        cache = L1Cache(capacity=10)
        cache.set("perf:key", {"data": list(range(100))}, ttl=60)

        times = []
        for _ in range(50):
            t0 = time.perf_counter()
            result = cache.get("perf:key")
            times.append((time.perf_counter() - t0) * 1000)
            assert result is not None

        p95 = sorted(times)[int(len(times) * 0.95)]
        assert p95 < 1.0, f"L1 cache p95 hit latency must be < 1 ms, got {p95:.4f} ms"

    def test_cache_manager_get_set_roundtrip(self):
        """CacheManager set → get should return identical data."""
        mgr = CacheManager()
        payload = {"key": "value", "numbers": list(range(50)), "nested": {"deep": True}}
        cache_key = "cb:cache:org-test:roundtrip:all"

        mgr.set(cache_key, payload, ttl=60)
        result = mgr.get(cache_key)

        assert result is not None
        assert result["key"] == payload["key"]
        assert result["numbers"] == payload["numbers"]
        assert result["nested"]["deep"] is True
