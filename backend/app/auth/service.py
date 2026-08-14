import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import jwt
from app.core.config import settings
from app.auth.schemas import UserResponse
from app.rbac.roles import get_permissions_for_role


class AuthService:
    @staticmethod
    def hash_password(password: str) -> str:
        return hashlib.sha256(password.encode("utf-8")).hexdigest()

    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        return AuthService.hash_password(plain_password) == hashed_password

    @staticmethod
    def create_access_token(user_data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        to_encode = user_data.copy()
        now = datetime.now(timezone.utc)
        if expires_delta:
            expire = now + expires_delta
        else:
            expire = now + timedelta(minutes=settings.JWT_EXPIRES_MINUTES)
            
        to_encode.update({
            "exp": expire,
            "iat": now,
            "iss": settings.JWT_ISSUER,
            "aud": settings.JWT_AUDIENCE,
        })
        return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

    @staticmethod
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

    @staticmethod
    def get_bootstrap_admin() -> UserResponse:
        role = "admin"
        return UserResponse(
            id="usr-admin-bootstrap",
            email=settings.ADMIN_BOOTSTRAP_EMAIL,
            display_name="Enterprise Admin",
            role=role,
            organization_id="org-company-brain-demo",
            permissions=get_permissions_for_role(role)
        )
