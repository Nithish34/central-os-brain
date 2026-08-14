from fastapi import APIRouter, Depends, HTTPException, status
from app.auth.schemas import LoginRequest, TokenResponse, UserResponse
from app.auth.service import AuthService
from app.auth.dependencies import get_current_user
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["Layer 5 — Authentication & RBAC"])


@router.post("/login", response_model=TokenResponse, summary="Authenticate user with email and password to receive JWT Bearer token")
def login(request: LoginRequest):
    # Check bootstrap admin
    if request.email == settings.ADMIN_BOOTSTRAP_EMAIL and request.password == settings.ADMIN_BOOTSTRAP_PASSWORD:
        admin_user = AuthService.get_bootstrap_admin()
        token = AuthService.create_access_token({
            "sub": admin_user.id,
            "email": admin_user.email,
            "name": admin_user.display_name,
            "role": admin_user.role,
            "org_id": admin_user.organization_id,
        })
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            expires_in=settings.JWT_EXPIRES_MINUTES * 60,
            user=admin_user
        )

    # Demo guest / developer fallback
    if request.password in ["password", "demo123", "secret"]:
        user = UserResponse(
            id=f"usr-{request.email.split('@')[0]}",
            email=request.email,
            display_name=request.email.split('@')[0].capitalize(),
            role="editor",
            organization_id="org-company-brain-demo",
            permissions=["events:read", "events:write", "conflicts:read", "conflicts:approve", "documents:read"]
        )
        token = AuthService.create_access_token({
            "sub": user.id,
            "email": user.email,
            "name": user.display_name,
            "role": user.role,
            "org_id": user.organization_id,
        })
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            expires_in=settings.JWT_EXPIRES_MINUTES * 60,
            user=user
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials. Use bootstrap email admin@companybrain.local / admin1234",
    )


@router.get("/me", response_model=UserResponse, summary="Get current authenticated user profile and permissions")
def get_me(user: UserResponse = Depends(get_current_user)):
    return user


@router.post("/refresh", response_model=TokenResponse, summary="Refresh existing JWT access token")
def refresh(user: UserResponse = Depends(get_current_user)):
    token = AuthService.create_access_token({
        "sub": user.id,
        "email": user.email,
        "name": user.display_name,
        "role": user.role,
        "org_id": user.organization_id,
    })
    return TokenResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.JWT_EXPIRES_MINUTES * 60,
        user=user
    )
