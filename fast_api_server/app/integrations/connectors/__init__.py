from app.integrations.registry import ConnectorRegistry
from app.integrations.connectors.slack import SlackConnector
from app.integrations.connectors.github import GitHubConnector
from app.integrations.connectors.stubs import (
    NotionConnector,
    JiraConnector,
    TeamsConnector,
    GmailConnector,
)

# Register active connectors
slack_connector = SlackConnector()
github_connector = GitHubConnector()

ConnectorRegistry.register(slack_connector)
ConnectorRegistry.register(github_connector)
ConnectorRegistry.register(NotionConnector)
ConnectorRegistry.register(JiraConnector)
ConnectorRegistry.register(TeamsConnector)
ConnectorRegistry.register(GmailConnector)

__all__ = [
    "slack_connector",
    "github_connector",
    "NotionConnector",
    "JiraConnector",
    "TeamsConnector",
    "GmailConnector",
]
