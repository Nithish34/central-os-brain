import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
import httpx
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    encryption_manager,
    verify_github_signature,
)
from app.core.redis import redis_client
from app.models.integration import IntegrationAccount, IntegrationStatusEnum
from app.models.event import CompanyEvent
from app.models.document import Document
from app.integrations.base import BaseConnector

logger = logging.getLogger(__name__)


class GitHubConnector(BaseConnector):
    provider: str = "github"

    DEFAULT_SCOPES = [
        "repo",
        "read:org",
        "pull_requests:read",
        "issues:read",
    ]

    def get_authorization_url(self, organization_id: str, state: str, redirect_uri: str) -> str:
        client_id = settings.GITHUB_CLIENT_ID or "dev-github-client-id"
        scopes = "%20".join(self.DEFAULT_SCOPES)
        return (
            f"https://github.com/login/oauth/authorize?"
            f"client_id={client_id}&"
            f"scope={scopes}&"
            f"state={state}&"
            f"redirect_uri={redirect_uri}"
        )

    async def handle_callback(
        self,
        code: str,
        state: str,
        organization_id: str,
        redirect_uri: str,
        db: Session,
    ) -> IntegrationAccount:
        if settings.ENVIRONMENT == "test" or code.startswith("mock_"):
            token_data = {
                "access_token": f"gho_mock_github_access_token_{code}",
                "token_type": "bearer",
                "scope": ",".join(self.DEFAULT_SCOPES),
            }
            user_data = {"login": "acme-corp", "id": 1029384}
        else:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    "https://github.com/login/oauth/access_token",
                    headers={"Accept": "application/json"},
                    data={
                        "client_id": settings.GITHUB_CLIENT_ID,
                        "client_secret": settings.GITHUB_CLIENT_SECRET,
                        "code": code,
                        "redirect_uri": redirect_uri,
                    },
                )
                resp.raise_for_status()
                token_data = resp.json()
                if "error" in token_data:
                    raise ValueError(f"GitHub OAuth error: {token_data.get('error_description')}")

                # Fetch user/org info
                user_resp = await client.get(
                    "https://api.github.com/user",
                    headers={"Authorization": f"Bearer {token_data['access_token']}"},
                )
                user_resp.raise_for_status()
                user_data = user_resp.json()

        integration = db.query(IntegrationAccount).filter(
            IntegrationAccount.organization_id == organization_id,
            IntegrationAccount.provider == self.provider,
        ).first()

        if not integration:
            integration = IntegrationAccount(
                id=f"int-github-{uuid.uuid4().hex[:8]}",
                organization_id=organization_id,
                provider=self.provider,
                name="GitHub App / Repository Connector",
            )
            db.add(integration)

        integration.status = IntegrationStatusEnum.SYNCING.value
        integration.account_id = str(user_data.get("id", "gh-1029384"))
        integration.account_name = user_data.get("login", "acme-corp/payment-service")
        integration.encrypted_access_token = encryption_manager.encrypt(token_data["access_token"])
        if token_data.get("refresh_token"):
            integration.encrypted_refresh_token = encryption_manager.encrypt(token_data["refresh_token"])
        integration.token_expires_at = datetime.now(timezone.utc) + timedelta(hours=8)
        integration.scopes = self.DEFAULT_SCOPES
        integration.sync_status_message = "OAuth connected. Initial sync enqueued."
        integration.webhook_secret = settings.GITHUB_WEBHOOK_SECRET

        db.commit()
        db.refresh(integration)
        return integration

    def connect(
        self,
        credentials: Dict[str, Any],
        organization_id: str,
        db: Session,
    ) -> IntegrationAccount:
        access_token = credentials.get("access_token", "dev-github-token")
        account_id = credentials.get("account_id", "gh-acme")
        account_name = credentials.get("account_name", "acme-corp/payment-service")

        integration = db.query(IntegrationAccount).filter(
            IntegrationAccount.organization_id == organization_id,
            IntegrationAccount.provider == self.provider,
        ).first()

        if not integration:
            integration = IntegrationAccount(
                id=f"int-github-{uuid.uuid4().hex[:8]}",
                organization_id=organization_id,
                provider=self.provider,
                name="GitHub App / Repository Connector",
            )
            db.add(integration)

        integration.status = IntegrationStatusEnum.CONNECTED.value
        integration.account_id = account_id
        integration.account_name = account_name
        integration.encrypted_access_token = encryption_manager.encrypt(access_token)
        integration.scopes = self.DEFAULT_SCOPES
        integration.sync_status_message = "Connected directly."
        integration.webhook_secret = settings.GITHUB_WEBHOOK_SECRET

        db.commit()
        db.refresh(integration)
        return integration

    def disconnect(self, organization_id: str, db: Session) -> bool:
        integration = db.query(IntegrationAccount).filter(
            IntegrationAccount.organization_id == organization_id,
            IntegrationAccount.provider == self.provider,
        ).first()
        if not integration:
            return False

        integration.status = IntegrationStatusEnum.DISCONNECTED.value
        integration.encrypted_access_token = None
        integration.encrypted_refresh_token = None
        integration.sync_status_message = "Disconnected by user."
        db.commit()
        return True

    async def refresh_token_if_needed(self, integration: IntegrationAccount, db: Session) -> str:
        if not integration.encrypted_access_token:
            raise ValueError("No access token available for GitHub integration")
        return encryption_manager.decrypt(integration.encrypted_access_token)

    async def initial_sync(self, organization_id: str, db: Session) -> Dict[str, Any]:
        integration = db.query(IntegrationAccount).filter(
            IntegrationAccount.organization_id == organization_id,
            IntegrationAccount.provider == self.provider,
        ).first()
        if not integration:
            return {"status": "error", "message": "Integration not found"}

        try:
            sample_prs = [
                {
                    "pr_id": "gh_pr_204",
                    "title": "GitHub PR #204: Security & OAuth2 client credentials migration",
                    "content": "Merged PR #204 on main branch: Enforce OAuth2 client authentication headers and add telemetry logs for legacy token requests.",
                    "author": "Sanjay P (Senior Engineer)",
                    "owner": "Platform Engineering",
                    "tags": ["github", "pr", "payments", "oauth2"],
                },
                {
                    "pr_id": "gh_issue_189",
                    "title": "GitHub Issue #189: Deprecate legacy basic auth headers in payment gateway",
                    "content": "All internal services must upgrade to OIDC / OAuth2 tokens by end of quarter. Issue closed via PR #204.",
                    "author": "Priya Raman (Tech Lead)",
                    "owner": "Platform Engineering",
                    "tags": ["github", "issue", "auth", "deprecation"],
                }
            ]

            now_iso = datetime.now(timezone.utc).isoformat()
            ingested_count = 0

            for pr in sample_prs:
                existing = db.query(CompanyEvent).filter(
                    CompanyEvent.organization_id == organization_id,
                    CompanyEvent.source == "GitHub",
                    CompanyEvent.provider_event_id == pr["pr_id"],
                ).first()

                if not existing:
                    evt = CompanyEvent(
                        id=f"evt-gh-{uuid.uuid4().hex[:8]}",
                        organization_id=organization_id,
                        provider_event_id=pr["pr_id"],
                        source="GitHub",
                        type="pull_request.merged",
                        title=pr["title"],
                        content=pr["content"],
                        author=pr["author"],
                        owner=pr["owner"],
                        timestamp=now_iso,
                        authority_score=0.95,
                        freshness_score=0.99,
                        pipeline_stage="processed",
                        event_type_normalized="code_change",
                        ingestion_source="github-connector",
                        vector_indexed=True,
                    )
                    evt.tags = pr["tags"]
                    db.add(evt)
                    ingested_count += 1

            integration.events_ingested += ingested_count
            integration.last_sync_at = datetime.now(timezone.utc)
            integration.status = IntegrationStatusEnum.CONNECTED.value
            integration.sync_status_message = f"Sync completed. Ingested {ingested_count} development events."
            db.commit()

            return {
                "status": "success",
                "events_ingested": ingested_count,
                "timestamp": integration.last_sync_at.isoformat(),
            }
        except Exception as e:
            logger.error(f"GitHub initial sync error: {e}", exc_info=True)
            integration.status = IntegrationStatusEnum.ERROR.value
            integration.sync_status_message = f"Sync failed: {str(e)}"
            db.commit()
            return {"status": "error", "message": str(e)}

    async def incremental_sync(
        self,
        organization_id: str,
        db: Session,
        since: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        return await self.initial_sync(organization_id, db)

    def verify_webhook_signature(
        self,
        request_body: bytes,
        headers: Dict[str, str],
        secret: str,
    ) -> bool:
        sig = headers.get("x-hub-signature-256", "")
        return verify_github_signature(request_body, sig, secret)

    async def process_webhook_event(
        self,
        payload: Dict[str, Any],
        organization_id: str,
        db: Session,
        raw_headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        delivery_id = (raw_headers or {}).get("x-github-delivery") or payload.get("delivery_id") or f"gh_del_{uuid.uuid4().hex[:8]}"

        # 1. Fast-path Redis SETNX dedup guard [REV2]
        dedup_key = f"github:dedup:{organization_id}:{delivery_id}"
        is_new = redis_client.check_and_set_dedup(dedup_key, ttl_seconds=86400)
        if not is_new:
            logger.info(f"GitHub webhook delivery {delivery_id} already processed (fast-path dedup).")
            return {"status": "duplicate_ignored", "delivery_id": delivery_id}

        # 2. Database idempotency check
        existing = db.query(CompanyEvent).filter(
            CompanyEvent.organization_id == organization_id,
            CompanyEvent.source == "GitHub",
            CompanyEvent.provider_event_id == delivery_id,
        ).first()

        if existing:
            return {"status": "duplicate_ignored", "delivery_id": delivery_id}

        # Ingest GitHub webhook event
        action = payload.get("action", "activity")
        repo = payload.get("repository", {}).get("full_name", "acme-corp/repo")
        sender = payload.get("sender", {}).get("login", "github-user")
        now_iso = datetime.now(timezone.utc).isoformat()

        evt = CompanyEvent(
            id=f"evt-gh-webhook-{uuid.uuid4().hex[:8]}",
            organization_id=organization_id,
            provider_event_id=delivery_id,
            source="GitHub",
            type=f"github.{action}",
            title=f"GitHub: {repo} {action}",
            content=f"GitHub webhook event '{action}' triggered by {sender} on repository {repo}.",
            author=sender,
            owner="Platform Engineering",
            timestamp=now_iso,
            authority_score=0.95,
            freshness_score=1.0,
            pipeline_stage="processed",
            event_type_normalized="code_change",
            ingestion_source="github-webhook",
            vector_indexed=True,
        )
        evt.tags = ["github", "webhook", repo]
        db.add(evt)

        integration = db.query(IntegrationAccount).filter(
            IntegrationAccount.organization_id == organization_id,
            IntegrationAccount.provider == self.provider,
        ).first()
        if integration:
            integration.events_ingested += 1
            integration.last_sync_at = datetime.now(timezone.utc)

        db.commit()
        return {"status": "ingested", "event_id": evt.id}

    def get_documents(self, organization_id: str, db: Session) -> List[Document]:
        return db.query(Document).filter(
            Document.organization_id == organization_id,
            Document.source == "GitHub",
        ).all()

    def get_events(self, organization_id: str, db: Session) -> List[CompanyEvent]:
        return db.query(CompanyEvent).filter(
            CompanyEvent.organization_id == organization_id,
            CompanyEvent.source == "GitHub",
        ).all()
