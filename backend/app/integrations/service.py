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
    def sync_provider(provider: Provider, db: Optional[Any] = None) -> IntegrationStatus:
        item = INTEGRATION_REGISTRY.get(provider)
        if not item:
            raise ValueError(f"Unknown provider {provider}")

        item.events_ingested += 1
        now_iso = datetime.now().astimezone().isoformat(timespec="seconds")
        item.last_sync = now_iso

        if db:
            import uuid
            from app.models.event import CompanyEvent
            from app.models.conflict import Conflict

            event_templates = {
                Provider.SLACK: {
                    "source": "Slack",
                    "type": "message.created",
                    "title": "Slack #engineering-sync: Real-time decision",
                    "content": "Decision confirmed in #engineering-sync: All microservices migrated to OAuth2 client credentials. Deprecation of legacy JWT endpoints is on track for Q3.",
                    "author": "Priya Raman (Tech Lead)",
                    "owner": "Platform Engineering",
                    "tags": ["slack", "payments", "oauth2", "architecture"],
                    "event_type_normalized": "architecture_decision",
                },
                Provider.GITHUB: {
                    "source": "GitHub",
                    "type": "pull_request.merged",
                    "title": f"GitHub PR #{200 + item.events_ingested}: Security & Auth middleware updates",
                    "content": f"Merged PR #{200 + item.events_ingested} on main branch: Enforce OAuth2 client authentication headers and add telemetry logs for legacy token requests.",
                    "author": "Sanjay P (Senior Engineer)",
                    "owner": "Platform Engineering",
                    "tags": ["github", "pr", "payments", "oauth2"],
                    "event_type_normalized": "code_change",
                },
                Provider.GMAIL: {
                    "source": "Gmail",
                    "type": "email.received",
                    "title": "Email: Billing Ops SLA Grace Period Extension",
                    "content": "Billing Operations announcement: Customer invoice payment SLA grace period is officially extended from 14 to 30 days for enterprise tiers. Automated dunning schedules have been updated.",
                    "author": "billing-ops@companybrain.local",
                    "owner": "Finance Operations",
                    "tags": ["gmail", "billing", "sla", "finance"],
                    "event_type_normalized": "policy_update",
                },
                Provider.TEAMS: {
                    "source": "Teams",
                    "type": "chat_message",
                    "title": "Teams #sec-ops: Zero-Trust PKCE and Hardware MFA standard",
                    "content": "CISO directive in #sec-ops: Deprecate legacy basic auth headers. Enforce OIDC OAuth 2.0 with PKCE and hardware MFA tokens across staging and prod.",
                    "author": "Elena Rostova (CISO)",
                    "owner": "Security Operations",
                    "tags": ["teams", "security", "auth", "mfa"],
                    "event_type_normalized": "security_policy",
                },
                Provider.JIRA: {
                    "source": "Jira",
                    "type": "process_ticket",
                    "title": f"Jira SRE-{300 + item.events_ingested}: Incident Runbook SLA Review",
                    "content": "Sev1 postmortem SLA confirmed at 48 hours. Primary on-call escalation rotation verified with Platform and SRE squads.",
                    "author": "Karthik V (SRE Lead)",
                    "owner": "SRE",
                    "tags": ["jira", "incident", "sre", "support"],
                    "event_type_normalized": "policy_validation",
                },
                Provider.NOTION: {
                    "source": "Notion",
                    "type": "document_sync",
                    "title": "Notion KB: Enterprise Onboarding SOP v3.2",
                    "content": "Implementation Squad owns onboarding for all accounts > Rs. 25L ACV. Customer Success manages relationship health scoring.",
                    "author": "Divya N (Customer Success)",
                    "owner": "Revenue Operations",
                    "tags": ["notion", "onboarding", "ownership", "kb"],
                    "event_type_normalized": "ownership_change",
                },
            }

            tmpl = event_templates.get(provider)
            if tmpl:
                evt = CompanyEvent(
                    id=f"evt-{provider.value}-sync-{uuid.uuid4().hex[:6]}",
                    source=tmpl["source"],
                    type=tmpl["type"],
                    title=tmpl["title"],
                    content=tmpl["content"],
                    author=tmpl["author"],
                    owner=tmpl["owner"],
                    timestamp=now_iso,
                    authority_score=0.92,
                    freshness_score=0.98,
                    pipeline_stage="processed",
                    event_type_normalized=tmpl["event_type_normalized"],
                    ingestion_source=f"{provider.value}-connector",
                    vector_indexed=True,
                )
                evt.tags = tmpl.get("tags", [])
                db.add(evt)
                db.commit()

        return item
