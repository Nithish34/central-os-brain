import hmac
import hashlib
import time
import uuid
import base64
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
import jwt
from cryptography.fernet import Fernet, InvalidToken
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError

from app.core.config import settings
from app.core.redis import redis_client

# Password hasher using Argon2id
ph = PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MB
    parallelism=4,
    hash_len=32,
    salt_len=16
)


class EncryptionManager:
    """
    Versioned token encryption / decryption utility.
    Supports key rotation where ciphertext is formatted as '{version}:{fernet_token}'.
    """
    def __init__(self):
        self._keys: Dict[str, Fernet] = {}
        self._current_version = "v1"
        self._load_keys()

    def _format_key(self, raw_key: str) -> bytes:
        # Fernet requires 32 url-safe base64-encoded bytes
        # If key is provided as plain text or pre-formatted, ensure 32 bytes base64
        try:
            # Check if valid Fernet key
            decoded = base64.urlsafe_b64decode(raw_key.encode("utf-8"))
            if len(decoded) == 32:
                return raw_key.encode("utf-8")
        except Exception:
            pass
        # Pad / hash to 32 bytes and urlsafe base64 encode
        digest = hashlib.sha256(raw_key.encode("utf-8")).digest()
        return base64.urlsafe_b64encode(digest)

    def _load_keys(self):
        curr = settings.ENCRYPTION_KEY_CURRENT
        if ":" in curr:
            ver, raw_key = curr.split(":", 1)
            self._current_version = ver
            self._keys[ver] = Fernet(self._format_key(raw_key))
        else:
            self._current_version = "v1"
            self._keys["v1"] = Fernet(self._format_key(curr))

        # Retired keys for rotation
        if settings.ENCRYPTION_KEY_RETIRED:
            for item in settings.ENCRYPTION_KEY_RETIRED.split(","):
                item = item.strip()
                if not item:
                    continue
                if ":" in item:
                    ver, raw_key = item.split(":", 1)
                    self._keys[ver] = Fernet(self._format_key(raw_key))
                else:
                    self._keys[f"retired_{len(self._keys)}"] = Fernet(self._format_key(item))

    def encrypt(self, plain_text: str) -> str:
        if not plain_text:
            return ""
        fernet = self._keys[self._current_version]
        token = fernet.encrypt(plain_text.encode("utf-8")).decode("utf-8")
        return f"{self._current_version}:{token}"

    def decrypt(self, cipher_text: str) -> str:
        if not cipher_text:
            return ""
        if ":" in cipher_text:
            ver, token = cipher_text.split(":", 1)
            fernet = self._keys.get(ver)
            if not fernet:
                raise ValueError(f"Unknown encryption key version: {ver}")
            try:
                return fernet.decrypt(token.encode("utf-8")).decode("utf-8")
            except InvalidToken as e:
                raise ValueError(f"Decryption failed for key version {ver}") from e
        else:
            # Legacy or unversioned fallback
            fernet = self._keys.get("v1") or list(self._keys.values())[0]
            return fernet.decrypt(cipher_text.encode("utf-8")).decode("utf-8")


encryption_manager = EncryptionManager()


# Password Hashing Utilities
def hash_password(password: str) -> str:
    return ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, InvalidHashError):
        # Fallback check for old sha256 hashes during migration
        if len(hashed_password) == 64 and not hashed_password.startswith("$argon2"):
            candidate = hashlib.sha256(plain_password.encode("utf-8")).hexdigest()
            return candidate == hashed_password
        return False


# JWT Token Utilities
def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.JWT_EXPIRES_MINUTES))
    to_encode.update({
        "exp": expire,
        "iat": now,
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
    })
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            audience=settings.JWT_AUDIENCE,
            issuer=settings.JWT_ISSUER,
        )
    except Exception:
        return None


# OAuth State Utilities (Redis-backed with TTL)
def create_oauth_state(organization_id: str, provider: str, ttl_seconds: int = 600) -> str:
    state = f"cb_st_{uuid.uuid4().hex}"
    key = f"oauth_state:{state}"
    payload = f"{organization_id}:{provider}:{time.time()}"
    redis_client.set_with_ttl(key, payload, ttl_seconds)
    return state


def verify_oauth_state(state: str, expected_provider: str) -> Optional[str]:
    """
    Validates state and returns the organization_id if valid, None otherwise.
    Applies a 60s grace-period TTL upon validation to prevent race conditions while protecting against replay attacks.
    """
    if not state:
        return None
    cleaned_state = state.strip()
    key = f"oauth_state:{cleaned_state}"
    payload = redis_client.get(key)
    if not payload:
        return None
    # Use 60s grace period rather than immediate deletion to tolerate duplicate GET prefetch
    redis_client.set_with_ttl(key, payload, ttl_seconds=60)
    try:
        org_id, prov, _ = payload.split(":", 2)
        if prov != expected_provider:
            return None
        return org_id
    except Exception:
        return None


# CSRF Token Utilities
def generate_csrf_token() -> str:
    return uuid.uuid4().hex


def verify_csrf_token(header_token: Optional[str], cookie_token: Optional[str]) -> bool:
    if not header_token or not cookie_token:
        return False
    return hmac.compare_digest(header_token, cookie_token)


# Webhook Signature Verification
def verify_slack_signature(request_body: bytes, timestamp_header: str, signature_header: str, signing_secret: str) -> bool:
    """
    Verifies Slack signature header 'v0=...'.
    Rejects signatures older than 5 minutes.
    """
    if not timestamp_header or not signature_header or not signing_secret:
        return False
    try:
        req_time = int(timestamp_header)
        if abs(time.time() - req_time) > 60 * 5:
            return False
    except ValueError:
        return False

    sig_basestring = f"v0:{timestamp_header}:{request_body.decode('utf-8', errors='replace')}".encode("utf-8")
    computed_signature = "v0=" + hmac.new(
        signing_secret.encode("utf-8"),
        sig_basestring,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(computed_signature, signature_header)


def verify_github_signature(request_body: bytes, signature_256_header: str, webhook_secret: str) -> bool:
    """
    Verifies GitHub signature header 'sha256=...'.
    """
    if not signature_256_header or not webhook_secret:
        return False
    if not signature_256_header.startswith("sha256="):
        return False

    computed_signature = "sha256=" + hmac.new(
        webhook_secret.encode("utf-8"),
        request_body,
        hashlib.sha256
    ).hexdigest()

    return hmac.compare_digest(computed_signature, signature_256_header)
