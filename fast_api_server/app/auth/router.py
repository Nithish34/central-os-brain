from typing import Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Response, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    generate_csrf_token,
    create_oauth_state,
    verify_oauth_state,
)
from app.models.user import User, UserRole
from app.auth.schemas import (
    LoginRequest,
    RegisterRequest,
    UserResponse,
    AuthResponse,
    RoleUpdateRequest,
    OAuthAuthorizeResponse,
    GoogleAuthRequest,
)
from app.auth.service import (
    AuthService,
    GoogleOAuthProvider,
    MicrosoftOAuthProvider,
)
from app.auth.dependencies import (
    get_current_user,
    get_tenant_repo,
    require_role,
)
from app.services.tenant_repository import TenantScopedRepository

router = APIRouter(prefix="/auth", tags=["Identity, Security & Multi-Tenancy"])


def set_auth_cookies(response: Response, token: str, csrf_token: str) -> None:
    # Set httpOnly JWT session cookie
    response.set_cookie(
        key=settings.JWT_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        max_age=settings.JWT_EXPIRES_MINUTES * 60,
        path="/",
    )
    # Set accessible CSRF cookie
    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        max_age=settings.JWT_EXPIRES_MINUTES * 60,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(settings.JWT_COOKIE_NAME, path="/")
    response.delete_cookie(settings.CSRF_COOKIE_NAME, path="/")


@router.post("/register", response_model=AuthResponse, summary="Register new organization and owner account")
def register(request: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    org, user = AuthService.register_organization_and_owner(
        db=db,
        email=request.email,
        password=request.password,
        full_name=request.full_name,
        org_name=request.organization_name,
        org_slug=request.organization_slug,
    )

    token = create_access_token({
        "sub": user.id,
        "org_id": org.id,
        "email": user.email,
        "name": user.full_name,
        "role": user.role,
    })
    csrf_token = generate_csrf_token()
    set_auth_cookies(response, token, csrf_token)

    return AuthResponse(
        user=AuthService.user_to_response(user),
        csrf_token=csrf_token,
        access_token=token,
        message="Organization and owner registered successfully",
    )


@router.post("/login", response_model=AuthResponse, summary="Authenticate user with email and password")
def login(request: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = AuthService.authenticate_user(
        db=db,
        email=request.email,
        password=request.password,
        org_slug=request.organization_slug,
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    token = create_access_token({
        "sub": user.id,
        "org_id": user.organization_id,
        "email": user.email,
        "name": user.full_name,
        "role": user.role,
    })
    csrf_token = generate_csrf_token()
    set_auth_cookies(response, token, csrf_token)

    # Log audit
    repo = TenantScopedRepository(db, user.organization_id, user.id, user.full_name or user.email)
    repo.log_audit(
        action="auth.login",
        title=f"User {user.email} logged in",
        target=user.id,
        reason="Password login",
    )

    return AuthResponse(
        user=AuthService.user_to_response(user),
        csrf_token=csrf_token,
        access_token=token,
        message="Login successful",
    )


@router.post("/logout", summary="Logout current user and clear cookies")
def logout(response: Response, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    clear_auth_cookies(response)
    repo = TenantScopedRepository(db, current_user.organization_id, current_user.id, current_user.full_name)
    repo.log_audit(
        action="auth.logout",
        title=f"User {current_user.email} logged out",
        target=current_user.id,
    )
    return {"message": "Logged out successfully"}


@router.get("/csrf", summary="Get or refresh CSRF token")
def get_csrf_token(response: Response):
    csrf_token = generate_csrf_token()
    response.set_cookie(
        key=settings.CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,
        secure=settings.JWT_COOKIE_SECURE,
        samesite=settings.JWT_COOKIE_SAMESITE,
        max_age=settings.JWT_EXPIRES_MINUTES * 60,
        path="/",
    )
    return {"csrf_token": csrf_token}


@router.get("/me", response_model=UserResponse, summary="Get current authenticated user profile")
def get_me(current_user: User = Depends(get_current_user)):
    return AuthService.user_to_response(current_user)


@router.get("/google/login", summary="Initiate Google OAuth login (redirects to Google consent screen)")
@router.get("/oauth/google/login", summary="Initiate Google OAuth login (alias)")
def google_login(
    org_id: Optional[str] = None,
    redirect_uri: Optional[str] = None,
):
    target_org_id = org_id or "org-default"
    state = create_oauth_state(target_org_id, "google")
    cb_redirect = redirect_uri or settings.GOOGLE_REDIRECT_URI or "http://localhost:8000/api/v1/auth/google/callback"
    auth_url = GoogleOAuthProvider.get_authorization_url(state, cb_redirect)
    return RedirectResponse(url=auth_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)


@router.get("/oauth/{provider}/authorize", response_model=OAuthAuthorizeResponse, summary="Initiate OAuth login flow")
def oauth_authorize(
    provider: str,
    org_id: Optional[str] = None,
    redirect_uri: Optional[str] = None,
):
    provider_lower = provider.lower()
    if provider_lower not in ("google", "microsoft"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported OAuth provider: {provider}",
        )

    target_org_id = org_id or "org-default"
    state = create_oauth_state(target_org_id, provider_lower)
    cb_redirect = redirect_uri or settings.GOOGLE_REDIRECT_URI or f"http://localhost:8000/api/v1/auth/oauth/{provider_lower}/callback"

    if provider_lower == "google":
        auth_url = GoogleOAuthProvider.get_authorization_url(state, cb_redirect)
    else:
        auth_url = MicrosoftOAuthProvider.get_authorization_url(state, cb_redirect)

    return OAuthAuthorizeResponse(authorization_url=auth_url, state=state)


@router.get("/oauth/{provider}/callback", response_model=AuthResponse, summary="Complete OAuth callback")
@router.get("/google/callback", response_model=AuthResponse, summary="Complete Google OAuth callback")
async def oauth_callback(
    request: Request,
    response: Response,
    code: str,
    state: str,
    provider: str = "google",
    redirect_uri: Optional[str] = None,
    db: Session = Depends(get_db),
):
    provider_lower = provider.lower()
    org_id = verify_oauth_state(state, provider_lower)
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state parameter.",
        )

    cb_redirect = redirect_uri or settings.GOOGLE_REDIRECT_URI or (
        "http://localhost:8000/api/v1/auth/google/callback"
        if provider_lower == "google"
        else f"http://localhost:8000/api/v1/auth/oauth/{provider_lower}/callback"
    )

    try:
        if provider_lower == "google":
            userinfo = await GoogleOAuthProvider.exchange_code(code, cb_redirect)
        elif provider_lower == "microsoft":
            userinfo = await MicrosoftOAuthProvider.exchange_code(code, cb_redirect)
        else:
            raise HTTPException(status_code=400, detail="Invalid provider")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth exchange failed: {str(e)}",
        )

    email = userinfo.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{provider.capitalize()} account did not return a valid email address.",
        )

    try:
        user = AuthService.authenticate_or_create_oauth_user(
            db=db,
            organization_id=org_id,
            provider=provider_lower,
            provider_user_id=userinfo.get("sub") or userinfo.get("id", "unknown"),
            email=email,
            full_name=userinfo.get("name", email.split("@")[0]),
        )
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve),
        )

    token = create_access_token({
        "sub": user.id,
        "org_id": user.organization_id,
        "email": user.email,
        "name": user.full_name,
        "role": user.role,
    })
    csrf_token = generate_csrf_token()

    # If direct browser navigation (Accept: text/html and not JSON), redirect to frontend
    accept_header = request.headers.get("accept", "")
    if "text/html" in accept_header and "application/json" not in accept_header:
        redirect_target = f"http://localhost:5173/?token={token}#chat"
        redirect_resp = RedirectResponse(url=redirect_target, status_code=status.HTTP_303_SEE_OTHER)
        set_auth_cookies(redirect_resp, token, csrf_token)
        return redirect_resp

    set_auth_cookies(response, token, csrf_token)

    return AuthResponse(
        user=AuthService.user_to_response(user),
        csrf_token=csrf_token,
        access_token=token,
        message=f"Authenticated via {provider} successfully",
    )


@router.post("/oauth/google/verify", response_model=AuthResponse, summary="Authenticate or register user via Google ID token / GIS credential")
@router.post("/google/verify", response_model=AuthResponse, summary="Alias for Google credential verification")
async def verify_google_credential(
    request: GoogleAuthRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    try:
        userinfo = await GoogleOAuthProvider.verify_id_token(request.credential)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google authentication failed: {str(e)}",
        )

    email = userinfo.get("email")
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account did not return a valid verified email address.",
        )

    user = AuthService.authenticate_or_create_oauth_user(
        db=db,
        organization_id=request.organization_id,
        provider="google",
        provider_user_id=userinfo.get("sub") or email,
        email=email,
        full_name=userinfo.get("name", email.split("@")[0]),
    )

    token = create_access_token({
        "sub": user.id,
        "org_id": user.organization_id,
        "email": user.email,
        "name": user.full_name,
        "role": user.role,
    })
    csrf_token = generate_csrf_token()
    set_auth_cookies(response, token, csrf_token)

    return AuthResponse(
        user=AuthService.user_to_response(user),
        csrf_token=csrf_token,
        access_token=token,
        message="Authenticated via Google successfully",
    )


@router.patch("/users/{user_id}/role", response_model=UserResponse, summary="Update a user's role in the organization")
def update_user_role(
    user_id: str,
    request: RoleUpdateRequest,
    current_user: User = Depends(require_role(UserRole.ADMIN.value)),
    tenant_repo: TenantScopedRepository = Depends(get_tenant_repo),
):
    valid_roles = [r.value for r in UserRole]
    if request.role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of {valid_roles}",
        )

    target_user = tenant_repo.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    old_role = target_user.role
    target_user.role = request.role
    tenant_repo.commit()
    tenant_repo.refresh(target_user)

    tenant_repo.log_audit(
        action="user.role_changed",
        title=f"User {target_user.email} role updated from {old_role} to {request.role}",
        target=target_user.id,
        reason=f"Role updated by {current_user.email}",
        risk_level="HIGH" if request.role in ("owner", "admin") else "MEDIUM",
    )

    return AuthService.user_to_response(target_user)
