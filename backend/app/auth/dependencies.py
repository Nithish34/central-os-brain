from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.auth.service import AuthService
from app.auth.schemas import UserResponse
from app.core.config import settings
from app.rbac.roles import get_permissions_for_role

security = HTTPBearer(auto_error=False)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> UserResponse:
    if not credentials:
        # For development/demo mode convenience, return the bootstrap admin if no auth is passed
        return AuthService.get_bootstrap_admin()

    token = credentials.credentials
    payload = AuthService.decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    role = payload.get("role", "viewer")
    return UserResponse(
        id=payload.get("sub", "usr-anonymous"),
        email=payload.get("email", "anonymous@example.com"),
        display_name=payload.get("name", "User"),
        role=role,
        organization_id=payload.get("org_id", "org-company-brain-demo"),
        permissions=get_permissions_for_role(role)
    )
