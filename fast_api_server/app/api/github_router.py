import logging
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, status, Query
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import get_db, SessionLocal
from app.models.user import User
from app.models.github_connection import GitHubConnection
from app.models.integration import IntegrationAccount, IntegrationStatusEnum
from app.auth.dependencies import get_current_user
from app.services.github_service import (
    GitHubOAuthService,
    GitHubRepoIngestionService,
    GitHubWebhookService,
    GITHUB_SCOPES,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["GitHub Integration & Continuous Ingestion"])


class GitHubConnectionStatusResponse(BaseModel):
    is_connected: bool
    connection_id: Optional[str] = None
    github_user_id: Optional[str] = None
    github_login: Optional[str] = None
    is_active: bool = False
    synced_repos: List[str] = []
    repo_count: int = 0
    last_polled_at: Optional[str] = None
    created_at: Optional[str] = None


def resolve_github_redirect_uri(request: Optional[Request] = None, explicit_uri: Optional[str] = None) -> str:
    """
    Resolve GitHub OAuth callback redirect URI in order of precedence:
    1. Explicit redirect_uri passed in query parameter or argument
    2. GITHUB_REDIRECT_URI environment variable
    3. PUBLIC_API_URL or BACKEND_URL environment variable
    4. Dynamically reconstructed from Request headers (X-Forwarded-Proto, X-Forwarded-Host)
    5. Fallback to request.base_url or configured host/port
    """
    if explicit_uri:
        return explicit_uri

    if settings.GITHUB_REDIRECT_URI:
        return settings.GITHUB_REDIRECT_URI

    if settings.PUBLIC_API_URL:
        return f"{settings.PUBLIC_API_URL.rstrip('/')}/api/github/callback"

    if settings.BACKEND_URL:
        return f"{settings.BACKEND_URL.rstrip('/')}/api/github/callback"

    if request is not None:
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        host = request.headers.get("x-forwarded-host", request.headers.get("host"))
        if proto and host:
            return f"{proto}://{host}/api/github/callback"
        return f"{request.base_url}api/github/callback"

    return f"http://{settings.HOST}:{settings.PORT}/api/github/callback"


def resolve_frontend_redirect_url(request: Request, status_query: str = "connected=github") -> str:
    """Determine the frontend URL to redirect user's browser after OAuth completion."""
    if settings.FRONTEND_URL:
        base = settings.FRONTEND_URL.rstrip('/')
    elif settings.PUBLIC_API_URL:
        base = settings.PUBLIC_API_URL.rstrip('/')
    else:
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        host = request.headers.get("x-forwarded-host", request.headers.get("host", "localhost:5173"))
        base = f"{proto}://{host}"
    return f"{base}/?{status_query}#connections"


def run_background_github_sync(connection_id: str):
    """Background task to scan and sync documentation for a specific connection."""
    import asyncio
    db = SessionLocal()
    try:
        conn = db.query(GitHubConnection).filter(GitHubConnection.id == connection_id).first()
        if conn is not None and bool(conn.is_active):
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor() as pool:
                        pool.submit(asyncio.run, GitHubRepoIngestionService.sync_connection(conn, db)).result(timeout=10)
                else:
                    loop.run_until_complete(GitHubRepoIngestionService.sync_connection(conn, db))
            except Exception:
                try:
                    asyncio.run(GitHubRepoIngestionService.sync_connection(conn, db))
                except Exception as inner_e:
                    logger.debug(f"Asyncio runner fallback: {inner_e}")
    except Exception as e:
        logger.error(f"Background GitHub documentation sync error for {connection_id}: {e}", exc_info=True)
    finally:
        db.close()


@router.get("/api/github/connect", summary="Initiate GitHub OAuth 2.0 connection")
def connect_github(
    request: Request,
    redirect_uri: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """
    Generate OAuth state and return authorization URL.
    Redirects browser directly to GitHub consent screen if HTML requested.
    """
    cb_url = resolve_github_redirect_uri(request, redirect_uri)
    auth_data = GitHubOAuthService.get_authorization_url(
        user_id=str(current_user.id),
        redirect_uri=cb_url,
        organization_id=str(current_user.organization_id) if current_user.organization_id else None,
    )

    accept_header = request.headers.get("accept", "")
    if "text/html" in accept_header and "application/json" not in accept_header:
        return RedirectResponse(url=auth_data["authorization_url"], status_code=status.HTTP_303_SEE_OTHER)

    return auth_data


@router.get("/api/github/callback", summary="Handle GitHub OAuth 2.0 callback")
async def github_callback(
    code: str,
    state: str,
    request: Request,
    background_tasks: BackgroundTasks,
    redirect_uri: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Publicly accessible endpoint (does not require Authorization header) since
    user identification is verified via the cryptographically secure state payload.
    """
    logger.info("=== GITHUB CALLBACK INVOKED ===")
    logger.info("Received query state: %s | code: %s", state, bool(code))
    cb_url = resolve_github_redirect_uri(request, redirect_uri)

    # 1. Validate state payload from Redis / disk cache
    state_payload = GitHubOAuthService.get_state_payload(state, consume=False)
    if not state_payload:
        logger.warning(f"GitHub callback received with invalid or expired state: {state}")
        redirect_err = resolve_frontend_redirect_url(request, "error=invalid_or_expired_state")
        return RedirectResponse(url=redirect_err, status_code=status.HTTP_303_SEE_OTHER)

    user_id = state_payload.get("user_id")
    stored_redirect_uri = state_payload.get("redirect_uri")
    if stored_redirect_uri and not settings.GITHUB_REDIRECT_URI and not redirect_uri:
        cb_url = stored_redirect_uri

    # 2. Retrieve user
    user = None
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
    elif state_payload.get("organization_id"):
        user = db.query(User).filter(User.organization_id == state_payload.get("organization_id")).first()

    if not user:
        logger.error(f"User for GitHub state {state} not found (user_id={user_id}).")
        redirect_err = resolve_frontend_redirect_url(request, "error=user_not_found")
        return RedirectResponse(url=redirect_err, status_code=status.HTTP_303_SEE_OTHER)

    # 3. Exchange code for credentials
    try:
        connection = await GitHubOAuthService.handle_callback(
            code=code,
            state=state,
            user=user,
            redirect_uri=cb_url,
            db=db,
            skip_state_validation=True,
        )
        GitHubOAuthService.consume_state(state)
    except Exception as exc:
        logger.error(f"GitHub OAuth callback failed during token exchange: {exc}", exc_info=True)
        redirect_err = resolve_frontend_redirect_url(request, "error=github_exchange_failed")
        return RedirectResponse(url=redirect_err, status_code=status.HTTP_303_SEE_OTHER)

    # 4. Enqueue immediate repo scanning pass
    background_tasks.add_task(run_background_github_sync, str(connection.id))

    accept_header = request.headers.get("accept", "")
    if "text/html" in accept_header and "application/json" not in accept_header:
        redirect_target = resolve_frontend_redirect_url(request, "connected=github")
        return RedirectResponse(url=redirect_target, status_code=status.HTTP_303_SEE_OTHER)

    return {
        "status": "connected",
        "connection_id": str(connection.id),
        "github_login": str(connection.github_login),
        "github_user_id": str(connection.github_user_id),
        "synced_repos": connection.get_synced_repos(),
        "message": "GitHub account connected successfully. Continuous repository scanning activated.",
    }


@router.get("/api/github/status", response_model=GitHubConnectionStatusResponse, summary="Get current user's GitHub connection status")
async def get_github_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check if the current authenticated user has an active GitHub connection and refresh live repos."""
    conn = db.query(GitHubConnection).filter(
        GitHubConnection.user_id == current_user.id,
        GitHubConnection.is_active == True,
    ).first()

    if not conn:
        return GitHubConnectionStatusResponse(is_connected=False, is_active=False)

    # Dynamic refresh of repositories if live token is connected
    try:
        token = conn.get_token()
        if token and not token.startswith("gho_mock_"):
            live_repos = await GitHubRepoIngestionService.fetch_user_repositories(token)
            if live_repos:
                conn.set_synced_repos(live_repos)
                GitHubRepoIngestionService.purge_mock_github_data(db, conn.organization_id or "org-default")
                db.commit()
    except Exception as e:
        logger.debug(f"Status check live repo refresh error: {e}")

    repos = conn.get_synced_repos()
    return GitHubConnectionStatusResponse(
        is_connected=True,
        connection_id=str(conn.id),
        github_user_id=str(conn.github_user_id) if conn.github_user_id is not None else None,
        github_login=str(conn.github_login) if conn.github_login is not None else None,
        is_active=bool(conn.is_active),
        synced_repos=repos,
        repo_count=len(repos),
        last_polled_at=conn.last_polled_at.isoformat() if conn.last_polled_at is not None else None,
        created_at=conn.created_at.isoformat() if conn.created_at is not None else None,
    )


@router.delete("/api/github/disconnect", summary="Disconnect GitHub workspace for current user")
def disconnect_github(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deactivate GitHub connection for the authenticated user."""
    success = GitHubOAuthService.disconnect(str(current_user.id), db)
    if not success:
        return {"status": "already_disconnected", "message": "No active GitHub connection found."}
    return {"status": "disconnected", "message": "GitHub workspace disconnected successfully."}


@router.post("/api/github/purge-mock-data", summary="Purge mock demo GitHub events and documents")
def purge_mock_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    org_id = current_user.organization_id or "org-default"
    GitHubRepoIngestionService.purge_mock_github_data(db, org_id)
    return {"status": "purged", "message": "Demo mock GitHub records purged successfully."}


@router.post("/api/github/sync", summary="Trigger repository document sync for current user's GitHub connection")
@router.post("/api/github/poll-now", summary="Alias for triggering repository document sync")
async def sync_github_now(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Trigger an on-demand documentation scan for the user's active GitHub connection."""
    conn = db.query(GitHubConnection).filter(
        GitHubConnection.user_id == current_user.id,
        GitHubConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active GitHub connection found.")

    try:
        token = conn.get_token()
        if token and not token.startswith("gho_mock_"):
            live_repos = await GitHubRepoIngestionService.fetch_user_repositories(token)
            if live_repos:
                conn.set_synced_repos(live_repos)
                GitHubRepoIngestionService.purge_mock_github_data(db, conn.organization_id or "org-default")
                db.commit()
    except Exception as e:
        logger.debug(f"Sync trigger live repo refresh error: {e}")

    background_tasks.add_task(run_background_github_sync, str(conn.id))
    return {"status": "sync_enqueued", "connection_id": str(conn.id), "repos": conn.get_synced_repos()}


@router.post("/api/v1/integrations/github/webhook", summary="Inbound GitHub Webhook Receiver")
@router.post("/api/github/webhook", summary="Inbound GitHub Webhook Receiver (Alias)")
async def github_webhook_endpoint(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Ingest GitHub push, pull_request, and issues webhooks.
    Verifies X-Hub-Signature-256 HMAC and deduplicates delivery in Redis.
    """
    raw_body = await request.body()
    headers = {k.lower(): v for k, v in request.headers.items()}

    try:
        payload = await request.json()
    except Exception:
        payload = {}

    # Target organization resolution
    org_id = headers.get("x-organization-id")
    if not org_id:
        integration = db.query(IntegrationAccount).filter(
            IntegrationAccount.provider == "github",
            IntegrationAccount.status.in_([IntegrationStatusEnum.CONNECTED.value, IntegrationStatusEnum.SYNCING.value]),
        ).first()
        org_id = integration.organization_id if integration else "org-default"

    res = await GitHubWebhookService.process_webhook(
        payload=payload,
        raw_body=raw_body,
        raw_headers=headers,
        db=db,
        organization_id=org_id,
    )

    if res.get("status") == "unauthorized":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Webhook signature verification failed.")

    return JSONResponse(content=res)
