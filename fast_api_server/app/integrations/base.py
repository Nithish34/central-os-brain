from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models.integration import IntegrationAccount, IntegrationProvider
from app.models.document import Document
from app.models.event import CompanyEvent


class BaseConnector(ABC):
    provider: str

    @abstractmethod
    def get_authorization_url(self, organization_id: str, state: str, redirect_uri: str) -> str:
        """Constructs provider-specific OAuth2 authorization URL with state parameter."""
        pass

    @abstractmethod
    async def handle_callback(
        self,
        code: str,
        state: str,
        organization_id: str,
        redirect_uri: str,
        db: Session,
    ) -> IntegrationAccount:
        """Exchanges OAuth code for access/refresh tokens and persists them encrypted."""
        pass

    @abstractmethod
    def connect(
        self,
        credentials: Dict[str, Any],
        organization_id: str,
        db: Session,
    ) -> IntegrationAccount:
        """Connects provider directly using API keys / tokens."""
        pass

    @abstractmethod
    def disconnect(self, organization_id: str, db: Session) -> bool:
        """Revokes stored tokens and sets status to disconnected."""
        pass

    @abstractmethod
    async def refresh_token_if_needed(self, integration: IntegrationAccount, db: Session) -> str:
        """
        Refreshes access token if near expiration (within 5 min window).
        Returns active decrypted access token.
        """
        pass

    @abstractmethod
    async def initial_sync(self, organization_id: str, db: Session) -> Dict[str, Any]:
        """
        Performs comprehensive first-time sync of company data into org-scoped tables.
        Executed in the background.
        """
        pass

    @abstractmethod
    async def incremental_sync(
        self,
        organization_id: str,
        db: Session,
        since: Optional[datetime] = None,
    ) -> Dict[str, Any]:
        """Syncs changes since last sync timestamp."""
        pass

    @abstractmethod
    def verify_webhook_signature(
        self,
        request_body: bytes,
        headers: Dict[str, str],
        secret: str,
    ) -> bool:
        """Verifies HMAC signature on incoming webhooks."""
        pass

    @abstractmethod
    async def process_webhook_event(
        self,
        payload: Dict[str, Any],
        organization_id: str,
        db: Session,
        raw_headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Processes real-time inbound webhook event with fast-path & DB dedup guards.
        """
        pass

    @abstractmethod
    def get_documents(self, organization_id: str, db: Session) -> List[Document]:
        """Returns synced documents for this provider."""
        pass

    @abstractmethod
    def get_events(self, organization_id: str, db: Session) -> List[CompanyEvent]:
        """Returns synced events for this provider."""
        pass

    def execute_action(
        self,
        action_type: str,
        payload: Dict[str, Any],
        organization_id: str,
        db: Session,
    ) -> Dict[str, Any]:
        """Stub reserved for Phase 9 Autonomous Safe Execution Gateway."""
        raise NotImplementedError("Action execution is reserved for Phase 9 Execution Gateway.")
