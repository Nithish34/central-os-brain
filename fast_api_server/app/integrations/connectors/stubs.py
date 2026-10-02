from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.integration import IntegrationAccount, IntegrationStatusEnum
from app.models.document import Document
from app.models.event import CompanyEvent
from app.integrations.base import BaseConnector


class StubConnector(BaseConnector):
    """
    Inert connector stub proving BaseConnector abstraction generalizes across providers.
    Full ingestion logic lands in subsequent phases.
    """
    def __init__(self, provider_name: str, display_name: str):
        self.provider = provider_name
        self.display_name = display_name

    def get_authorization_url(self, organization_id: str, state: str, redirect_uri: str) -> str:
        return f"https://auth.{self.provider}.com/oauth/authorize?state={state}&redirect_uri={redirect_uri}"

    async def handle_callback(
        self,
        code: str,
        state: str,
        organization_id: str,
        redirect_uri: str,
        db: Session,
    ) -> IntegrationAccount:
        integration = db.query(IntegrationAccount).filter(
            IntegrationAccount.organization_id == organization_id,
            IntegrationAccount.provider == self.provider,
        ).first()

        if not integration:
            integration = IntegrationAccount(
                id=f"int-{self.provider}-stub",
                organization_id=organization_id,
                provider=self.provider,
                name=self.display_name,
            )
            db.add(integration)

        integration.status = IntegrationStatusEnum.CONNECTED.value
        integration.sync_status_message = "Connected (Stub connector mode)."
        db.commit()
        db.refresh(integration)
        return integration

    def connect(
        self,
        credentials: Dict[str, Any],
        organization_id: str,
        db: Session,
    ) -> IntegrationAccount:
        integration = db.query(IntegrationAccount).filter(
            IntegrationAccount.organization_id == organization_id,
            IntegrationAccount.provider == self.provider,
        ).first()

        if not integration:
            integration = IntegrationAccount(
                id=f"int-{self.provider}-stub",
                organization_id=organization_id,
                provider=self.provider,
                name=self.display_name,
            )
            db.add(integration)

        integration.status = IntegrationStatusEnum.CONNECTED.value
        integration.sync_status_message = "Connected directly (Stub)."
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
        integration.sync_status_message = "Disconnected."
        db.commit()
        return True

    async def refresh_token_if_needed(self, integration: IntegrationAccount, db: Session) -> str:
        return "stub-token"

    async def initial_sync(self, organization_id: str, db: Session) -> Dict[str, Any]:
        return {"status": "success", "events_ingested": 0, "message": f"{self.display_name} stub sync complete"}

    async def incremental_sync(
        self,
        organization_id: str,
        db: Session,
        since: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        return {"status": "success", "events_ingested": 0}

    def verify_webhook_signature(
        self,
        request_body: bytes,
        headers: Dict[str, str],
        secret: str,
    ) -> bool:
        return True

    async def process_webhook_event(
        self,
        payload: Dict[str, Any],
        organization_id: str,
        db: Session,
        raw_headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        return {"status": "ignored_stub", "provider": self.provider}

    def get_documents(self, organization_id: str, db: Session) -> List[Document]:
        return []

    def get_events(self, organization_id: str, db: Session) -> List[CompanyEvent]:
        return []


NotionConnector = StubConnector("notion", "Notion Official Knowledge Base")
JiraConnector = StubConnector("jira", "Atlassian Jira Cloud")
TeamsConnector = StubConnector("teams", "Microsoft Teams Change Notifications")
GmailConnector = StubConnector("gmail", "Google Cloud Pub/Sub Gmail Ingestion")
