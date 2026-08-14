import hmac
import hashlib
import time
from typing import Optional
from fastapi import Request, HTTPException, status
from app.core.config import settings


def verify_slack_signature(request: Request, body_bytes: bytes) -> bool:
    signing_secret = settings.SLACK_SIGNING_SECRET
    if not signing_secret:
        return True  # Bypass in demo/dev mode if not configured

    timestamp = request.headers.get("x-slack-request-timestamp")
    signature = request.headers.get("x-slack-signature")
    if not timestamp or not signature:
        return False

    # Check timestamp age (within 5 minutes)
    try:
        req_time = float(timestamp)
        if abs(time.time() - req_time) > 300:
            return False
    except ValueError:
        return False

    sig_basestring = f"v0:{timestamp}:{body_bytes.decode('utf-8', errors='ignore')}"
    my_signature = "v0=" + hmac.new(
        signing_secret.encode("utf-8"),
        sig_basestring.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(my_signature, signature)


def verify_github_signature(request: Request, body_bytes: bytes) -> bool:
    secret = settings.GITHUB_WEBHOOK_SECRET
    if not secret:
        return True

    signature = request.headers.get("x-hub-signature-256")
    if not signature:
        return False

    expected_signature = "sha256=" + hmac.new(
        secret.encode("utf-8"),
        body_bytes,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(expected_signature, signature)
