from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel


class Provider(str, Enum):
    SLACK = "slack"
    TEAMS = "teams"
    GITHUB = "github"
    GMAIL = "gmail"
    JIRA = "jira"
    NOTION = "notion"


class IntegrationStatus(BaseModel):
    provider: Provider
    name: str
    status: str  # connected, setup_required, disconnected
    icon: str
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    events_ingested: int = 0
    last_sync: Optional[str] = None
    webhook_endpoint: str
    scopes: List[str] = []


class ConnectRequest(BaseModel):
    account_id: str
    account_name: Optional[str] = None
    credentials: Optional[Dict[str, Any]] = None
