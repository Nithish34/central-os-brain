from typing import Optional, Callable
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.user import User
from app.models.organization import Organization
from app.rbac.roles import has_role_level, get_permissions_for_role
from app.services.tenant_repository import TenantScopedRepository

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login",
    auto_error=False,
)


def get_token_from_request(request: Request, header_token: Optional[str] = Depends(oauth2_scheme)) -> Optional[str]:
    # 1. Primary: httpOnly cookie (REV2 requirement)
    cookie_token = request.cookies.get(settings.JWT_COOKIE_NAME)
    if cookie_token:
        return cookie_token
    # 2. Secondary: Authorization: Bearer <token>
    if header_token:
        return header_token
    return None


def get_current_user(
    token: Optional[str] = Depends(get_token_from_request),
    db: Session = Depends(get_db),
) -> User:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials required. Please log in.",
        )

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired session token.",
        )

    user_id = payload.get("sub")
    org_id = payload.get("org_id")

    if not user_id or not org_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed token claims.",
        )

    user = db.query(User).filter(User.id == user_id, User.organization_id == org_id).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found or disabled.",
        )

    # Verify organization is active (not soft-deleted via deactivated_at)
    if not user.organization or user.organization.deactivated_at is not None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization has been deactivated or removed.",
        )

    return user


def get_optional_current_user(
    token: Optional[str] = Depends(get_token_from_request),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if not token:
        return None
    try:
        return get_current_user(token=token, db=db)
    except HTTPException:
        return None


def get_tenant_repo(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TenantScopedRepository:
    return TenantScopedRepository(
        db=db,
        organization_id=current_user.organization_id,
        actor_id=current_user.id,
        actor_name=current_user.full_name or current_user.email,
    )


def require_role(min_role: str) -> Callable:
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if not has_role_level(current_user.role, min_role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Requires minimum role: {min_role}.",
            )
        return current_user
    return role_checker


def require_permission(permission: str) -> Callable:
    def permission_checker(current_user: User = Depends(get_current_user)) -> User:
        perms = get_permissions_for_role(current_user.role)
        if permission not in perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: '{permission}'.",
            )
        return current_user
    return permission_checker
