from typing import Optional, Dict, Any, List
from datetime import datetime
from pydantic import BaseModel, Field


class ActorSchema(BaseModel):
    id: str
    displayName: Optional[str] = None
    email: Optional[str] = None


class ContentSchema(BaseModel):
    title: Optional[str] = None
    text: Optional[str] = None
    html: Optional[str] = None
    summary: Optional[str] = None


class ContextSchema(BaseModel):
    workspaceId: Optional[str] = None
    channelId: Optional[str] = None
    teamId: Optional[str] = None
    repositoryId: Optional[str] = None
    repositoryName: Optional[str] = None
    threadId: Optional[str] = None
    messageId: Optional[str] = None
    emailMessageId: Optional[str] = None


class VisibilitySchema(BaseModel):
    type: str = "public"  # public, private, restricted, unknown
    sourceNative: Optional[Any] = None


class CanonicalCompanyEvent(BaseModel):
    eventId: str
    organizationId: str = "org-company-brain-demo"
    source: str  # slack, teams, github, gmail
    sourceEventId: str
    eventType: str  # message.created, pull_request.merged, issue.opened, email.received, etc.
    actor: ActorSchema
    occurredAt: str
    receivedAt: str
    content: ContentSchema
    context: ContextSchema
    sourceUrl: Optional[str] = None
    visibility: VisibilitySchema = Field(default_factory=VisibilitySchema)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    correlationId: str


class IngestionItemResult(BaseModel):
    eventId: str
    sourceEventId: str
    eventType: str
    status: str  # normalized, duplicate


class IngestionResponse(BaseModel):
    correlationId: str
    source: str
    results: List[IngestionItemResult]
    pipelineTriggered: bool = True
