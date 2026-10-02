from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel


class Provider(str, Enum):
    SLACK = "slack"
    GITHUB = "github"
    NOTION = "notion"
    JIRA = "jira"
    TEAMS = "teams"
    GMAIL = "gmail"


class IntegrationStatusResponse(BaseModel):
    provider: Provider
    name: str
    status: str  # connected, disconnected, syncing, error
    icon: str
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    events_ingested: int = 0
    last_sync: Optional[str] = None
    sync_status_message: Optional[str] = None
    webhook_endpoint: str
    scopes: List[str] = []


class ConnectRequest(BaseModel):
    account_id: Optional[str] = None
    account_name: Optional[str] = None
    access_token: Optional[str] = None
    credentials: Optional[Dict[str, Any]] = None


class SyncTriggerResponse(BaseModel):
    provider: str
    status: str
    message: str


class WebhookIngestResponse(BaseModel):
    status: str
    event_id: Optional[str] = None
    message: Optional[str] = None
