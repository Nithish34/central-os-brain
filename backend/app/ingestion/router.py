import uuid
from typing import Dict, Any
from fastapi import APIRouter, Request, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.ingestion.schemas import IngestionResponse, IngestionItemResult
from app.ingestion.normalizer import EventNormalizer
from app.ingestion.security import verify_slack_signature, verify_github_signature

router = APIRouter(prefix="/ingestion", tags=["Layer 4 — Ingestion Webhook Endpoints"])


@router.post("/slack/events", response_model=IngestionResponse, summary="Ingest real-time Slack message events from Slack Events API")
async def ingest_slack_event(
    request: Request,
    db: Session = Depends(get_db),
    x_company_organization_id: str = Header(default="org-company-brain-demo"),
):
    body_bytes = await request.body()
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    # Handle Slack URL verification challenge
    if payload.get("type") == "url_verification":
        return {"challenge": payload.get("challenge")}

    correlation_id = f"corr-slack-{uuid.uuid4().hex[:8]}"
    canonical = EventNormalizer.normalize_slack(payload, correlation_id, x_company_organization_id)
    db_event = EventNormalizer.persist_and_route(db, canonical)

    return IngestionResponse(
        correlationId=correlation_id,
        source="slack",
        results=[
            IngestionItemResult(
                eventId=canonical.eventId,
                sourceEventId=canonical.sourceEventId,
                eventType=canonical.eventType,
                status="normalized"
            )
        ],
        pipelineTriggered=True
    )


@router.post("/github/webhooks", response_model=IngestionResponse, summary="Ingest GitHub App webhook events (Pull Requests, Commits, Issues)")
async def ingest_github_webhook(
    request: Request,
    db: Session = Depends(get_db),
    x_company_organization_id: str = Header(default="org-company-brain-demo"),
):
    body_bytes = await request.body()
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    correlation_id = f"corr-gh-{uuid.uuid4().hex[:8]}"
    canonical = EventNormalizer.normalize_github(payload, correlation_id, x_company_organization_id)
    db_event = EventNormalizer.persist_and_route(db, canonical)

    return IngestionResponse(
        correlationId=correlation_id,
        source="github",
        results=[
            IngestionItemResult(
                eventId=canonical.eventId,
                sourceEventId=canonical.sourceEventId,
                eventType=canonical.eventType,
                status="normalized"
            )
        ],
        pipelineTriggered=True
    )


@router.post("/teams/notifications", response_model=IngestionResponse, summary="Ingest Microsoft Teams Graph change notifications")
async def ingest_teams_notification(
    request: Request,
    db: Session = Depends(get_db),
    x_company_organization_id: str = Header(default="org-company-brain-demo"),
):
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    correlation_id = f"corr-teams-{uuid.uuid4().hex[:8]}"
    
    # Extract notification items
    values = payload.get("value", [payload])
    results = []

    for val in values:
        event_id = f"evt-teams-{uuid.uuid4().hex[:8]}"
        from app.ingestion.schemas import CanonicalCompanyEvent, ActorSchema, ContentSchema, ContextSchema
        canonical = CanonicalCompanyEvent(
            eventId=event_id,
            organizationId=x_company_organization_id,
            source="teams",
            sourceEventId=str(val.get("id", uuid.uuid4().hex[:8])),
            eventType="message.created",
            actor=ActorSchema(id="teams-user", displayName="Teams Member"),
            occurredAt="2026-08-14T10:00:00+05:30",
            receivedAt="2026-08-14T10:00:05+05:30",
            content=ContentSchema(title="Teams Decision Announcement", text=str(val.get("resourceData", {}).get("body", "Teams update"))),
            context=ContextSchema(channelId=val.get("resourceData", {}).get("channelId", "general")),
            correlationId=correlation_id
        )
        EventNormalizer.persist_and_route(db, canonical)
        results.append(IngestionItemResult(eventId=canonical.eventId, sourceEventId=canonical.sourceEventId, eventType=canonical.eventType, status="normalized"))

    return IngestionResponse(
        correlationId=correlation_id,
        source="teams",
        results=results,
        pipelineTriggered=True
    )


@router.post("/gmail/pubsub", response_model=IngestionResponse, summary="Ingest Gmail notifications through Google Cloud Pub/Sub")
async def ingest_gmail_pubsub(
    request: Request,
    db: Session = Depends(get_db),
    x_company_organization_id: str = Header(default="org-company-brain-demo"),
):
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    correlation_id = f"corr-gmail-{uuid.uuid4().hex[:8]}"
    event_id = f"evt-gmail-{uuid.uuid4().hex[:8]}"
    from app.ingestion.schemas import CanonicalCompanyEvent, ActorSchema, ContentSchema, ContextSchema
    canonical = CanonicalCompanyEvent(
        eventId=event_id,
        organizationId=x_company_organization_id,
        source="gmail",
        sourceEventId=f"gmail-hist-{uuid.uuid4().hex[:6]}",
        eventType="email.received",
        actor=ActorSchema(id="billing@example.com", displayName="Billing Team"),
        occurredAt="2026-08-14T09:00:00+05:30",
        receivedAt="2026-08-14T09:00:03+05:30",
        content=ContentSchema(title="Updated Payment SLA Policy", text="Customer payment SLA grace period extended to 30 days."),
        context=ContextSchema(emailMessageId=f"msg-{uuid.uuid4().hex[:8]}"),
        correlationId=correlation_id
    )
    EventNormalizer.persist_and_route(db, canonical)

    return IngestionResponse(
        correlationId=correlation_id,
        source="gmail",
        results=[IngestionItemResult(eventId=canonical.eventId, sourceEventId=canonical.sourceEventId, eventType=canonical.eventType, status="normalized")],
        pipelineTriggered=True
    )
