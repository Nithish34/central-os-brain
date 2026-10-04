import logging
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, status, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.config import settings
from app.core.database import get_db, SessionLocal
from app.models.user import User
from app.models.slack_connection import SlackConnection
from app.auth.dependencies import get_current_user
from app.services.slack_service import SlackOAuthService, SlackMessageReadingService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/slack", tags=["Slack Integration & Continuous Ingestion"])


class SlackConnectionStatusResponse(BaseModel):
    is_connected: bool
    connection_id: Optional[str] = None
    slack_team_id: Optional[str] = None
    slack_user_id: Optional[str] = None
    is_active: bool = False
    last_polled_at: Optional[str] = None
    created_at: Optional[str] = None


def resolve_slack_redirect_uri(request: Optional[Request] = None, explicit_uri: Optional[str] = None) -> str:
    """
    Resolve the Slack OAuth callback redirect URI in order of precedence:
    1. Explicit redirect_uri passed in query parameter or argument
    2. SLACK_REDIRECT_URI environment variable (e.g. https://<subdomain>.ngrok-free.app/api/slack/callback)
    3. PUBLIC_API_URL or BACKEND_URL environment variable
    4. Dynamically reconstructed from Request headers (X-Forwarded-Proto, X-Forwarded-Host)
    5. Fallback to request.base_url or configured host/port
    """
    if explicit_uri:
        return explicit_uri

    if settings.SLACK_REDIRECT_URI:
        return settings.SLACK_REDIRECT_URI

    if settings.PUBLIC_API_URL:
        return f"{settings.PUBLIC_API_URL.rstrip('/')}/api/slack/callback"

    if settings.BACKEND_URL:
        return f"{settings.BACKEND_URL.rstrip('/')}/api/slack/callback"

    if request is not None:
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        host = request.headers.get("x-forwarded-host", request.headers.get("host"))
        if proto and host:
            return f"{proto}://{host}/api/slack/callback"
        return f"{request.base_url}api/slack/callback"

    return f"http://{settings.HOST}:{settings.PORT}/api/slack/callback"


def resolve_frontend_redirect_url(request: Request, status_query: str = "connected=slack") -> str:
    """
    Determine the frontend URL to redirect the user's browser to after OAuth completion:
    1. FRONTEND_URL setting (e.g. http://localhost:5173 or https://<subdomain>.ngrok-free.app)
    2. PUBLIC_API_URL setting if frontend is served by FastAPI
    3. Forwarded headers or request base url
    """
    if settings.FRONTEND_URL:
        base = settings.FRONTEND_URL.rstrip('/')
    elif settings.PUBLIC_API_URL:
        base = settings.PUBLIC_API_URL.rstrip('/')
    else:
        proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        host = request.headers.get("x-forwarded-host", request.headers.get("host", "localhost:5173"))
        base = f"{proto}://{host}"
    return f"{base}/?{status_query}#connections"


def run_background_slack_poll(connection_id: str):
    """Background task to poll messages for a specific connection."""
    db = SessionLocal()
    try:
        conn = db.query(SlackConnection).filter(SlackConnection.id == connection_id).first()
        if conn is not None and bool(conn.is_active):
            SlackMessageReadingService.poll_connection(conn, db)
    except Exception as e:
        logger.error(f"Background Slack message poll error for {connection_id}: {e}", exc_info=True)
    finally:
        db.close()


@router.get("/connect", summary="Initiate Slack OAuth 2.0 connection")
def connect_slack(
    request: Request,
    redirect_uri: Optional[str] = None,
    current_user: User = Depends(get_current_user),
):
    """
    Generate OAuth state and return authorization URL.
    Redirects browser directly to Slack consent screen.
    """
    cb_url = resolve_slack_redirect_uri(request, redirect_uri)
    auth_data = SlackOAuthService.get_authorization_url(str(current_user.id), cb_url)

    accept_header = request.headers.get("accept", "")
    if "text/html" in accept_header and "application/json" not in accept_header:
        return RedirectResponse(url=auth_data["authorization_url"], status_code=status.HTTP_303_SEE_OTHER)

    return auth_data


@router.get("/callback", summary="Handle Slack OAuth 2.0 callback")
async def slack_callback(
    code: str,
    state: str,
    request: Request,
    background_tasks: BackgroundTasks,
    redirect_uri: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    Exchange authorization code for access token, store encrypted credentials,
    and initiate background message polling.

    Publicly accessible endpoint (does not require Authorization header) since
    user identification is verified via the cryptographically secure state payload.
    """
    logger.info("=== SLACK CALLBACK INVOKED ===")
    logger.info("Received query state: %s | code: %s", state, bool(code))
    cb_url = resolve_slack_redirect_uri(request, redirect_uri)

    # 1. Validate state payload from Redis (non-destructive initial read to handle browser prefetch/dual-requests)
    state_payload = SlackOAuthService.get_state_payload(state, consume=False)
    if not state_payload:
        logger.warning(f"Slack callback received with invalid or expired state: {state}")
        redirect_err = resolve_frontend_redirect_url(request, "error=invalid_or_expired_state")
        return RedirectResponse(url=redirect_err, status_code=status.HTTP_303_SEE_OTHER)

    user_id = state_payload.get("user_id")

    # 2. Match exact redirect_uri recorded during authorization
    stored_redirect_uri = state_payload.get("redirect_uri")
    if stored_redirect_uri and not settings.SLACK_REDIRECT_URI and not redirect_uri:
        cb_url = stored_redirect_uri

    # 3. Retrieve user entity from state payload
    user = None
    if user_id:
        user = db.query(User).filter(User.id == user_id).first()
    elif state_payload.get("organization_id"):
        user = db.query(User).filter(User.organization_id == state_payload.get("organization_id")).first()

    if not user:
        logger.error(f"User for Slack state {state} not found in database (user_id={user_id}, org={state_payload.get('organization_id')}).")
        redirect_err = resolve_frontend_redirect_url(request, "error=user_not_found")
        return RedirectResponse(url=redirect_err, status_code=status.HTTP_303_SEE_OTHER)

    # 4. Exchange code for Slack credentials
    try:
        connection = await SlackOAuthService.handle_callback(
            code=code,
            state=state,
            user=user,
            redirect_uri=cb_url,
            db=db,
            skip_state_validation=True,
        )
        # Invalidate state with grace period after successful connection
        SlackOAuthService.consume_state(state)
    except Exception as exc:
        logger.error(f"Slack OAuth callback failed during token exchange: {exc}", exc_info=True)
        redirect_err = resolve_frontend_redirect_url(request, "error=slack_exchange_failed")
        return RedirectResponse(url=redirect_err, status_code=status.HTTP_303_SEE_OTHER)

    # 5. Enqueue immediate message reading pass
    background_tasks.add_task(run_background_slack_poll, str(connection.id))

    accept_header = request.headers.get("accept", "")
    if "text/html" in accept_header and "application/json" not in accept_header:
        redirect_target = resolve_frontend_redirect_url(request, "connected=slack")
        return RedirectResponse(
            url=redirect_target,
            status_code=status.HTTP_303_SEE_OTHER,
        )

    return {
        "status": "connected",
        "connection_id": str(connection.id),
        "slack_team_id": str(connection.slack_team_id),
        "slack_user_id": str(connection.slack_user_id) if connection.slack_user_id is not None else None,
        "message": "Slack workspace connected successfully. Continuous message reading activated.",
    }


@router.get("/status", response_model=SlackConnectionStatusResponse, summary="Get current user's Slack connection status")
def get_slack_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check if the current authenticated user has an active Slack workspace connection."""
    conn = db.query(SlackConnection).filter(
        SlackConnection.user_id == current_user.id,
        SlackConnection.is_active == True,
    ).first()

    if not conn:
        return SlackConnectionStatusResponse(is_connected=False, is_active=False)

    return SlackConnectionStatusResponse(
        is_connected=True,
        connection_id=str(conn.id),
        slack_team_id=str(conn.slack_team_id),
        slack_user_id=str(conn.slack_user_id) if conn.slack_user_id is not None else None,
        is_active=bool(conn.is_active),
        last_polled_at=conn.last_polled_at.isoformat() if conn.last_polled_at is not None else None,
        created_at=conn.created_at.isoformat() if conn.created_at is not None else None,
    )


@router.delete("/disconnect", summary="Disconnect Slack workspace for current user")
def disconnect_slack(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deactivate Slack connection for the authenticated user."""
    success = SlackOAuthService.disconnect(str(current_user.id), db)
    if not success:
        return {"status": "already_disconnected", "message": "No active Slack connection found."}
    return {"status": "disconnected", "message": "Slack workspace disconnected successfully."}


@router.post("/poll-now", summary="Manually trigger message polling for current user's Slack connection")
def poll_slack_now(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Trigger an on-demand message reading pass for the user's active connection."""
    conn = db.query(SlackConnection).filter(
        SlackConnection.user_id == current_user.id,
        SlackConnection.is_active == True,
    ).first()
    if not conn:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No active Slack connection found.")

    background_tasks.add_task(run_background_slack_poll, str(conn.id))
    return {"status": "poll_enqueued", "connection_id": str(conn.id)}