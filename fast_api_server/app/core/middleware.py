import hashlib
import logging
import time
from typing import Callable
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse, Response as StarletteResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.config import settings
from app.core.redis import redis_client
from app.core.security import verify_csrf_token

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "img-src 'self' data: https: blob:; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net blob:; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; "
            "font-src 'self' data: https://fonts.gstatic.com; "
            "worker-src 'self' blob: https://cdn.jsdelivr.net; "
            "connect-src 'self' ws: wss: http: https: blob:;"
        )
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    CSRF verification for cookie-authenticated state-changing requests.
    Public webhooks and unauthenticated login routes are exempt.
    """
    EXEMPT_PATHS = [
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/logout",
        "/api/v1/auth/csrf",
        "/api/v1/auth/oauth",
        "/api/v1/auth/google",
        "/api/v1/integrations/slack/webhook",
        "/api/v1/integrations/github/webhook",
        "/api/slack",
        "/api/v1/ingestion",
        "/api/v1/health",
        "/api/v1/chat",
        "/api/chat",
        "/api/v1/search",
        "/docs",
        "/openapi.json",
        "/redoc",
    ]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        method = request.method.upper()

        # Check exemptions
        if method in ("GET", "HEAD", "OPTIONS") or any(path.startswith(p) for p in self.EXEMPT_PATHS):
            return await call_next(request)

        # Check if auth cookie is present
        auth_cookie = request.cookies.get(settings.JWT_COOKIE_NAME)
        if auth_cookie:
            csrf_cookie = request.cookies.get(settings.CSRF_COOKIE_NAME)
            csrf_header = request.headers.get(settings.CSRF_HEADER_NAME)

            if not verify_csrf_token(csrf_header, csrf_cookie):
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"detail": "CSRF validation failed. Missing or invalid X-CSRF-Token header."},
                )

        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Redis-backed rate limiting middleware across app instances.
    """
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if settings.ENVIRONMENT == "test":
            return await call_next(request)

        path = request.url.path
        client_ip = request.client.host if request.client else "unknown"

        # Apply stricter limit for auth routes
        if path.startswith(f"{settings.API_V1_STR}/auth"):
            allowed, remaining = redis_client.rate_limit_check(
                identifier=f"auth:{client_ip}",
                limit=settings.AUTH_RATE_LIMIT_PER_MINUTE,
                window_seconds=60,
            )
            if not allowed:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Too many authentication requests. Please try again later."},
                    headers={"Retry-After": "60"},
                )
        elif path.startswith(f"{settings.API_V1_STR}"):
            allowed, remaining = redis_client.rate_limit_check(
                identifier=f"api:{client_ip}",
                limit=settings.PUBLIC_RATE_LIMIT_PER_MINUTE,
                window_seconds=60,
            )
            if not allowed:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Rate limit exceeded. Please throttle your requests."},
                    headers={"Retry-After": "60"},
                )

        return await call_next(request)


class ETagMiddleware(BaseHTTPMiddleware):
    """
    ETag-based conditional response middleware.

    For safe read-only methods (GET, HEAD), this middleware:
      1. Calls the next handler to get the full response body.
      2. Hashes the body with SHA-1 to produce a short ETag.
      3. Attaches the ETag in the response header.
      4. If the client sent ``If-None-Match`` matching the ETag, returns
         a ``304 Not Modified`` with no body (saving bandwidth entirely).

    Only applies to 200-range JSON / text responses.
    Skipped for binary content types (images, files, streams).
    """

    _BINARY_TYPES = {"application/octet-stream", "audio/", "video/", "image/"}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.method.upper() not in ("GET", "HEAD"):
            return await call_next(request)

        response = await call_next(request)

        # Only cache-able success responses deserve ETags
        if response.status_code < 200 or response.status_code >= 300:
            return response

        content_type = response.headers.get("content-type", "")
        if any(content_type.startswith(bt) for bt in self._BINARY_TYPES):
            return response

        # Read the response body
        body = b""
        async for chunk in response.body_iterator:
            body += chunk if isinstance(chunk, bytes) else chunk.encode()

        # Generate ETag from content
        etag = f'"{hashlib.sha1(body, usedforsecurity=False).hexdigest()[:16]}"'

        # 304 short-circuit: no body, no content-length
        client_etag = request.headers.get("if-none-match", "")
        if client_etag and etag in (e.strip() for e in client_etag.split(",")):
            return StarletteResponse(
                status_code=304,
                headers={"ETag": etag, "Cache-Control": response.headers.get("cache-control", "")},
            )

        # Return full response preserving all original headers (including multi-value Set-Cookie)
        new_response = StarletteResponse(
            content=body,
            status_code=response.status_code,
            media_type=response.media_type,
        )
        raw_headers = [
            (k, v) for k, v in response.raw_headers
            if k.lower() not in (b"etag", b"content-length")
        ]
        raw_headers.append((b"etag", etag.encode("latin-1")))
        raw_headers.append((b"content-length", str(len(body)).encode("latin-1")))
        new_response.raw_headers = raw_headers
        return new_response


class CacheControlMiddleware(BaseHTTPMiddleware):
    """
    Applies ``Cache-Control`` headers to every outgoing response based
    on the route category:

    - Hashed static assets (``/assets/*``, ``/images/*``):
        ``public, max-age=31536000, immutable``
    - SPA HTML (``/``, ``*.html``):
        ``no-cache, must-revalidate``
    - Auth routes (``/api/*/auth/*``):
        ``no-store, no-cache, must-revalidate, max-age=0``
    - Authenticated read API routes:
        ``private, max-age=30, stale-while-revalidate=60``
    - POST / mutation responses:
        ``no-store``

    Existing ``Cache-Control`` headers set by endpoint handlers take priority
    and are never overwritten.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Never override if endpoint already set a Cache-Control header
        if "cache-control" in response.headers:
            return response

        path = request.url.path
        method = request.method.upper()

        # 1. Hashed static assets — immutable, cache 1 year
        if path.startswith(("/assets/", "/images/", "/static/assets/")):
            response.headers["Cache-Control"] = "public, max-age=31536000, immutable"

        # 2. Auth routes — no caching, ever
        elif "/auth/" in path or path.endswith("/auth"):
            response.headers["Cache-Control"] = (
                "no-store, no-cache, must-revalidate, max-age=0"
            )

        # 3. Mutation methods — do not store
        elif method in ("POST", "PUT", "PATCH", "DELETE"):
            response.headers["Cache-Control"] = "no-store"

        # 4. HTML / SPA — revalidate on every navigation
        elif path == "/" or path.endswith(".html"):
            response.headers["Cache-Control"] = "no-cache, must-revalidate"

        # 5. Authenticated API reads & OpenAPI schema — short-lived private caching
        elif path.startswith(("/api/", "/api/v1/", "/openapi.json")):
            response.headers["Cache-Control"] = (
                "private, max-age=30, stale-while-revalidate=60"
            )

        return response


class ServerTimingMiddleware(BaseHTTPMiddleware):
    """
    Injects ``Server-Timing`` headers for Chrome DevTools / Lighthouse profiling.

    Emits a single ``app`` timing metric measuring total ASGI processing time::

        Server-Timing: app;dur=12.4

    Endpoint handlers can enrich timing by storing additional metrics in
    ``request.state.server_timing`` as a dict ``{"metric_name": ms_float}``.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        t_start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - t_start) * 1000

        # Build Server-Timing value
        timings = [f"app;dur={elapsed_ms:.1f}"]

        # Merge any extra timings set by endpoint handlers
        extra: dict = getattr(request.state, "server_timing", {})
        for name, dur_ms in extra.items():
            timings.append(f"{name};dur={dur_ms:.1f}")

        response.headers["Server-Timing"] = ", ".join(timings)
        return response
