import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, BackgroundTasks, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db, SessionLocal
from app.models.user import User, UserRole
from app.models.integration import IntegrationAccount, IntegrationProvider, IntegrationStatusEnum
from app.integrations.schemas import (
    Provider,
    IntegrationStatusResponse,
    ConnectRequest,
    SyncTriggerResponse,
    WebhookIngestResponse,
)
from app.integrations.registry import ConnectorRegistry, OAuthManager
import app.integrations.connectors  # Ensure connectors are registered
from app.auth.dependencies import get_current_user, require_role, get_tenant_repo
from app.services.tenant_repository import TenantScopedRepository

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/integrations", tags=["Phase 3 — Universal Integration Platform"])

PROVIDER_ICONS = {
    "slack": "💬",
    "github": "🐙",
    "teams": "👥",
    "gmail": "✉️",
    "jira": "🎯",
    "notion": "📖",
}

PROVIDER_NAMES = {
    "slack": "Slack Workspace Connector",
    "github": "GitHub App / Webhooks",
    "teams": "Microsoft Teams Change Notifications",
    "gmail": "Google Cloud Pub/Sub Gmail Ingestion",
    "jira": "Atlassian Jira Cloud",
    "notion": "Notion Official Knowledge Base",
}

PROVIDER_ENDPOINTS = {
    "slack": "/api/v1/integrations/slack/webhook",
    "github": "/api/v1/integrations/github/webhook",
    "teams": "/api/v1/integrations/teams/webhook",
    "gmail": "/api/v1/integrations/gmail/webhook",
    "jira": "/api/v1/integrations/jira/webhook",
    "notion": "/api/v1/integrations/notion/webhook",
}


def run_background_sync(provider: str, organization_id: str):
    """
    Background worker function for asynchronous initial / incremental sync [REV2].
    Uses isolated database session.
    """
    db = SessionLocal()
    try:
        connector = ConnectorRegistry.get(provider)
        if connector:
            import asyncio
            asyncio.run(connector.initial_sync(organization_id, db))
    except Exception as e:
        logger.error(f"Background sync failed for {provider} in org {organization_id}: {e}", exc_info=True)
    finally:
        db.close()


@router.get("", response_model=List[IntegrationStatusResponse], summary="List all integration statuses for organization")
def get_integrations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    accounts = db.query(IntegrationAccount).filter(
        IntegrationAccount.organization_id == current_user.organization_id
    ).all()
    accounts_by_provider = {acc.provider: acc for acc in accounts}

    result = []
    for prov in Provider:
        acc = accounts_by_provider.get(prov.value)
        status = acc.status if acc else "disconnected"
        last_sync = acc.last_sync_at.isoformat() if acc and acc.last_sync_at else None
        events_ingested = acc.events_ingested if acc else 0
        account_id = acc.account_id if acc else None
        account_name = acc.account_name if acc else None
        sync_msg = acc.sync_status_message if acc else None
        scopes = acc.scopes if acc else []

        result.append(
            IntegrationStatusResponse(
                provider=prov,
                name=PROVIDER_NAMES.get(prov.value, prov.value.capitalize()),
                status=status,
                icon=PROVIDER_ICONS.get(prov.value, "🔌"),
                account_id=account_id,
                account_name=account_name,
                events_ingested=events_ingested,
                last_sync=last_sync,
                sync_status_message=sync_msg,
                webhook_endpoint=PROVIDER_ENDPOINTS.get(prov.value, f"/api/v1/integrations/{prov.value}/webhook"),
                scopes=scopes,
            )
        )
    return result


@router.get("/{provider}/authorize", summary="Generate OAuth authorization URL for connector")
def authorize_connector(
    provider: str,
    redirect_uri: Optional[str] = None,
    current_user: User = Depends(require_role(UserRole.ADMIN.value)),
):
    connector = ConnectorRegistry.get(provider)
    if not connector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connector not found for provider '{provider}'.",
        )

    state = OAuthManager.generate_state(current_user.organization_id, provider)
    cb_redirect = redirect_uri or f"http://localhost:8000/api/v1/integrations/{provider}/callback"
    auth_url = connector.get_authorization_url(current_user.organization_id, state, cb_redirect)

    return {"authorization_url": auth_url, "state": state}


@router.get("/{provider}/callback", summary="Handle OAuth callback and trigger background initial sync")
async def oauth_callback(
    provider: str,
    code: str,
    state: str,
    background_tasks: BackgroundTasks,
    redirect_uri: Optional[str] = None,
    db: Session = Depends(get_db),
):
    org_id = OAuthManager.validate_state(state, provider)
    if not org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state parameter.",
        )

    connector = ConnectorRegistry.get(provider)
    if not connector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connector not found for provider '{provider}'.",
        )

    cb_redirect = redirect_uri or f"http://localhost:8000/api/v1/integrations/{provider}/callback"

    try:
        # Synchronous token exchange & encrypted persistence
        integration = await connector.handle_callback(code, state, org_id, cb_redirect, db)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"OAuth token exchange failed: {str(e)}",
        )

    # [REV2] Enqueue initial_sync as background task and return immediately
    background_tasks.add_task(run_background_sync, provider, org_id)

    # Audit log
    repo = TenantScopedRepository(db, org_id, None, "OAuth Callback")
    repo.log_audit(
        action="integration.connected",
        title=f"Integration {provider} connected via OAuth",
        target=integration.id,
        reason="OAuth callback success",
        risk_level="MEDIUM",
    )

    return {
        "status": "syncing",
        "provider": provider,
        "message": "OAuth connected successfully. Initial data sync is running in the background.",
    }


@router.post("/{provider}/connect", summary="Connect integration directly with API credentials")
def connect_connector(
    provider: str,
    request: ConnectRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(UserRole.ADMIN.value)),
    db: Session = Depends(get_db),
):
    connector = ConnectorRegistry.get(provider)
    if not connector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connector not found for provider '{provider}'.",
        )

    creds = request.credentials or {}
    if request.access_token:
        creds["access_token"] = request.access_token
    if request.account_id:
        creds["account_id"] = request.account_id
    if request.account_name:
        creds["account_name"] = request.account_name

    integration = connector.connect(creds, current_user.organization_id, db)

    # Enqueue background sync
    background_tasks.add_task(run_background_sync, provider, current_user.organization_id)

    repo = TenantScopedRepository(db, current_user.organization_id, current_user.id, current_user.full_name)
    repo.log_audit(
        action="integration.connected",
        title=f"Integration {provider} connected directly",
        target=integration.id,
    )

    return {
        "status": "syncing",
        "provider": provider,
        "message": f"{provider} connected. Background sync started.",
    }


@router.post("/{provider}/disconnect", summary="Disconnect integration and revoke stored tokens")
def disconnect_connector(
    provider: str,
    current_user: User = Depends(require_role(UserRole.ADMIN.value)),
    db: Session = Depends(get_db),
):
    connector = ConnectorRegistry.get(provider)
    if not connector:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Connector not found for provider '{provider}'.",
        )

    success = connector.disconnect(current_user.organization_id, db)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Integration not active.")

    repo = TenantScopedRepository(db, current_user.organization_id, current_user.id, current_user.full_name)
    repo.log_audit(
        action="integration.disconnected",
        title=f"Integration {provider} disconnected",
        target=provider,
        risk_level="MEDIUM",
    )

    return {"status": "disconnected", "provider": provider, "message": "Tokens revoked and integration disconnected."}


@router.post("/{provider}/sync", response_model=SyncTriggerResponse, summary="Manually trigger sync")
def sync_connector(
    provider: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(UserRole.MANAGER.value)),
    db: Session = Depends(get_db),
):
    connector = ConnectorRegistry.get(provider)
    if not connector:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown provider '{provider}'.")

    integration = db.query(IntegrationAccount).filter(
        IntegrationAccount.organization_id == current_user.organization_id,
        IntegrationAccount.provider == provider,
    ).first()

    if not integration or integration.status not in (IntegrationStatusEnum.CONNECTED.value, IntegrationStatusEnum.SYNCING.value):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Integration must be connected to sync.")

    integration.status = IntegrationStatusEnum.SYNCING.value
    integration.sync_status_message = "Incremental sync enqueued."
    db.commit()

    background_tasks.add_task(run_background_sync, provider, current_user.organization_id)

    return SyncTriggerResponse(
        provider=provider,
        status="syncing",
        message=f"Sync for {provider} enqueued in background.",
    )


@router.post("/{provider}/webhook", response_model=WebhookIngestResponse, summary="Receive inbound provider webhook")
async def receive_webhook(
    provider: str,
    request: Request,
    org_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    connector = ConnectorRegistry.get(provider)
    if not connector:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No connector for provider '{provider}'.")

    raw_body = await request.body()
    headers = {k.lower(): v for k, v in request.headers.items()}

    # Resolve target organization
    target_org_id = org_id
    if not target_org_id:
        integration = db.query(IntegrationAccount).filter(
            IntegrationAccount.provider == provider,
            IntegrationAccount.status.in_([IntegrationStatusEnum.CONNECTED.value, IntegrationStatusEnum.SYNCING.value])
        ).first()
        target_org_id = integration.organization_id if integration else "org-default"

    # Signature verification
    secret = (
        settings.SLACK_SIGNING_SECRET if provider == "slack"
        else settings.GITHUB_WEBHOOK_SECRET if provider == "github"
        else "demo_secret"
    )

    if not connector.verify_webhook_signature(raw_body, headers, secret):
        logger.warning(f"Webhook signature verification failed for provider {provider}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Webhook signature verification failed.",
        )

    try:
        payload = await request.json()
    except Exception:
        payload = {}

    # Handle special handshakes before normalization (e.g. Slack url_verification)
    if provider == "slack" and payload.get("type") == "url_verification":
        return WebhookIngestResponse(status="ok", message=payload.get("challenge", ""))

    # Phase 4: Canonical Normalization & Transactional Outbox Ingestion
    from app.events.normalizers.registry import NormalizerRegistry
    from app.events.ingestion import EventIngestionService

    normalizer = NormalizerRegistry.get(provider)
    if normalizer:
        try:
            canonical, record, is_new, outbox = EventIngestionService.normalize_and_ingest(
                db=db,
                provider=provider,
                payload=payload,
                organization_id=target_org_id,
                raw_headers=headers,
            )
            # Update integration account event counter
            integration = db.query(IntegrationAccount).filter(
                IntegrationAccount.organization_id == target_org_id,
                IntegrationAccount.provider == provider,
            ).first()
            if integration and is_new:
                integration.events_ingested += 1
                integration.last_sync_at = datetime.now(timezone.utc)
                db.commit()

            status_text = "ingested" if is_new else "duplicate_ignored"
            return WebhookIngestResponse(
                status=status_text,
                event_id=record.id,
                message="Webhook durably recorded and queued in outbox." if is_new else "Duplicate webhook ignored.",
            )
        except Exception as e:
            logger.error(f"Event normalization/ingestion failed for {provider}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Durable event ingestion failed: {str(e)}",
            )

    # Fallback to direct connector processing
    result = await connector.process_webhook_event(
        payload=payload,
        organization_id=target_org_id,
        db=db,
        raw_headers=headers,
    )

    if "challenge" in result:
        return WebhookIngestResponse(status="ok", message=result["challenge"])

    return WebhookIngestResponse(
        status=result.get("status", "processed"),
        event_id=result.get("event_id"),
        message="Webhook received and processed.",
    )
