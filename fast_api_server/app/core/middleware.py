import logging
from typing import Callable
from fastapi import Request, Response, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

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
        "/api/v1/ingestion",
        "/api/v1/health",
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
