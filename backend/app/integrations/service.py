from datetime import datetime
from typing import List, Dict, Optional
from app.integrations.schemas import Provider, IntegrationStatus


INTEGRATION_REGISTRY: Dict[Provider, IntegrationStatus] = {
    Provider.SLACK: IntegrationStatus(
        provider=Provider.SLACK,
        name="Slack Workspace Connector",
        status="connected",
        icon="💬",
        account_id="T04839210",
        account_name="Acme Corp Engineering",
        events_ingested=42,
        last_sync=datetime.now().astimezone().isoformat(timespec="seconds"),
        webhook_endpoint="/api/v1/ingestion/slack/events",
        scopes=["channels:history", "groups:history", "chat:write", "users:read"],
    ),
    Provider.GITHUB: IntegrationStatus(
        provider=Provider.GITHUB,
        name="GitHub App / Webhooks",
        status="connected",
        icon="🐙",
        account_id="org-github-acme",
        account_name="acme-corp/payment-service",
        events_ingested=28,
        last_sync=datetime.now().astimezone().isoformat(timespec="seconds"),
        webhook_endpoint="/api/v1/ingestion/github/webhooks",
        scopes=["pull_requests:read", "issues:read", "contents:write"],
    ),
    Provider.TEAMS: IntegrationStatus(
        provider=Provider.TEAMS,
        name="Microsoft Teams Change Notifications",
        status="connected",
        icon="👥",
        account_id="ms-teams-tenant-123",
        account_name="Acme Platform Teams",
        events_ingested=19,
        last_sync=datetime.now().astimezone().isoformat(timespec="seconds"),
        webhook_endpoint="/api/v1/ingestion/teams/notifications",
        scopes=["ChannelMessage.Read.All", "Group.Read.All"],
    ),
    Provider.GMAIL: IntegrationStatus(
        provider=Provider.GMAIL,
        name="Google Cloud Pub/Sub Gmail Ingestion",
        status="connected",
        icon="✉️",
        account_id="ops@companybrain.local",
        account_name="Engineering Ops Mailbox",
        events_ingested=15,
        last_sync=datetime.now().astimezone().isoformat(timespec="seconds"),
        webhook_endpoint="/api/v1/ingestion/gmail/pubsub",
        scopes=["https://www.googleapis.com/auth/gmail.readonly"],
    ),
    Provider.JIRA: IntegrationStatus(
        provider=Provider.JIRA,
        name="Atlassian Jira Cloud",
        status="connected",
        icon="🎯",
        account_id="jira-cloud-acme",
        account_name="Acme Jira Service Desk",
        events_ingested=22,
        last_sync=datetime.now().astimezone().isoformat(timespec="seconds"),
        webhook_endpoint="/api/v1/workflows",
        scopes=["read:jira-work", "write:jira-work"],
    ),
    Provider.NOTION: IntegrationStatus(
        provider=Provider.NOTION,
        name="Notion Official Knowledge Base",
        status="connected",
        icon="📖",
        account_id="notion-workspace-platform",
        account_name="Engineering Wiki",
        events_ingested=14,
        last_sync=datetime.now().astimezone().isoformat(timespec="seconds"),
        webhook_endpoint="/api/v1/documents",
        scopes=["read_content", "update_content"],
    ),
}


class IntegrationService:
    @staticmethod
    def get_all() -> List[IntegrationStatus]:
        return list(INTEGRATION_REGISTRY.values())

    @staticmethod
    def get_by_provider(provider: Provider) -> Optional[IntegrationStatus]:
        return INTEGRATION_REGISTRY.get(provider)

    @staticmethod
    def connect_provider(provider: Provider, account_id: str, account_name: Optional[str] = None) -> IntegrationStatus:
        item = INTEGRATION_REGISTRY.get(provider)
        if item:
            item.status = "connected"
            item.account_id = account_id
            if account_name:
                item.account_name = account_name
            item.last_sync = datetime.now().astimezone().isoformat(timespec="seconds")
            return item
        raise ValueError(f"Unknown provider {provider}")

    @staticmethod
    def sync_provider(provider: Provider) -> IntegrationStatus:
        item = INTEGRATION_REGISTRY.get(provider)
        if item:
            item.events_ingested += 1
            item.last_sync = datetime.now().astimezone().isoformat(timespec="seconds")
            return item
        raise ValueError(f"Unknown provider {provider}")
