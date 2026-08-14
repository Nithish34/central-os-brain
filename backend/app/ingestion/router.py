import uuid
from datetime import datetime
from typing import Dict, Any
from fastapi import APIRouter, Request, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.ingestion.schemas import IngestionResponse, IngestionItemResult
from app.ingestion.normalizer import EventNormalizer
from app.ingestion.security import verify_slack_signature, verify_github_signature

from fastapi.responses import JSONResponse

router = APIRouter(prefix="/ingestion", tags=["Layer 4 — Ingestion Webhook Endpoints"])


@router.post("/slack/events", summary="Ingest real-time Slack message events from Slack Events API")
async def ingest_slack_event(
    request: Request,
    db: Session = Depends(get_db),
    x_company_organization_id: str = Header(default="org-company-brain-demo"),
):
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    # Handle Slack URL verification challenge immediately
    if payload.get("type") == "url_verification":
        return JSONResponse(content={"challenge": payload.get("challenge")})

    correlation_id = f"corr-slack-{uuid.uuid4().hex[:8]}"
    canonical = EventNormalizer.normalize_slack(payload, correlation_id, x_company_organization_id)
    db_event = EventNormalizer.persist_and_route(db, canonical)

    return JSONResponse(content={
        "correlationId": correlation_id,
        "source": "slack",
        "results": [
            {
                "eventId": canonical.eventId,
                "sourceEventId": canonical.sourceEventId,
                "eventType": canonical.eventType,
                "status": "normalized"
            }
        ],
        "pipelineTriggered": True
    })


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


@router.post("/teams/notifications", summary="Ingest Microsoft Teams Outgoing Webhooks and Graph notifications")
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
    from app.ingestion.schemas import CanonicalCompanyEvent, ActorSchema, ContentSchema, ContextSchema

    # Case 1: Teams Outgoing Webhook (Standard / Free Teams)
    if "text" in payload and "from" in payload:
        raw_text = payload.get("text", "")
        # Remove mention tag if present (e.g., "<at>Bot</at> ")
        import re
        clean_text = re.sub(r"<at>.*?</at>", "", raw_text).strip()
        user_name = payload.get("from", {}).get("name", "Teams Member")
        event_id = f"evt-teams-{uuid.uuid4().hex[:8]}"

        canonical = CanonicalCompanyEvent(
            eventId=event_id,
            organizationId=x_company_organization_id,
            source="teams",
            sourceEventId=str(payload.get("id", uuid.uuid4().hex[:8])),
            eventType="message.created",
            actor=ActorSchema(id=payload.get("from", {}).get("id", "teams-user"), displayName=user_name),
            occurredAt=datetime.now().astimezone().isoformat(timespec="seconds"),
            receivedAt=datetime.now().astimezone().isoformat(timespec="seconds"),
            content=ContentSchema(
                title=f"Teams message in {payload.get('channelName', 'channel')}",
                text=clean_text or raw_text,
                summary=clean_text[:140] if clean_text else "Teams decision"
            ),
            context=ContextSchema(
                channelId=payload.get("channelId", "general"),
                teamId=payload.get("teamId")
            ),
            correlationId=correlation_id
        )
        EventNormalizer.persist_and_route(db, canonical)

        # Teams Outgoing Webhook expects a message reply back
        return JSONResponse(content={
            "type": "message",
            "text": f"🧠 **Company Brain OS:** Ingested and analyzed event from {user_name}."
        })

    # Case 2: Graph Notifications or Generic JSON payload
    values = payload.get("value", [payload])
    results = []

    for val in values:
        event_id = f"evt-teams-{uuid.uuid4().hex[:8]}"
        body_text = val.get("resourceData", {}).get("body", val.get("text", "Teams update"))
        canonical = CanonicalCompanyEvent(
            eventId=event_id,
            organizationId=x_company_organization_id,
            source="teams",
            sourceEventId=str(val.get("id", uuid.uuid4().hex[:8])),
            eventType="message.created",
            actor=ActorSchema(id="teams-user", displayName="Teams Member"),
            occurredAt=datetime.now().astimezone().isoformat(timespec="seconds"),
            receivedAt=datetime.now().astimezone().isoformat(timespec="seconds"),
            content=ContentSchema(title="Teams Decision Announcement", text=str(body_text)),
            context=ContextSchema(channelId=val.get("resourceData", {}).get("channelId", "general")),
            correlationId=correlation_id
        )
        EventNormalizer.persist_and_route(db, canonical)
        results.append({"eventId": canonical.eventId, "sourceEventId": canonical.sourceEventId, "eventType": canonical.eventType, "status": "normalized"})

    return JSONResponse(content={
        "correlationId": correlation_id,
        "source": "teams",
        "results": results,
        "pipelineTriggered": True
    })


@router.post("/gmail/pubsub", summary="Ingest Gmail notifications through Google Cloud Pub/Sub or Google Apps Script")
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

    # Check if direct Apps Script or PubSub
    subject = payload.get("subject", "Gmail Update")
    body_text = payload.get("body", payload.get("text", "Customer payment SLA grace period extended to 30 days."))
    from_user = payload.get("from", "billing-ops@companybrain.local")

    canonical = CanonicalCompanyEvent(
        eventId=event_id,
        organizationId=x_company_organization_id,
        source="gmail",
        sourceEventId=str(payload.get("emailId", f"gmail-{uuid.uuid4().hex[:6]}")),
        eventType="email.received",
        actor=ActorSchema(id=from_user, displayName=from_user),
        occurredAt=datetime.now().astimezone().isoformat(timespec="seconds"),
        receivedAt=datetime.now().astimezone().isoformat(timespec="seconds"),
        content=ContentSchema(
            title=f"Email: {subject}",
            text=f"Subject: {subject}\n\n{body_text}",
            summary=body_text[:140]
        ),
        context=ContextSchema(emailMessageId=str(payload.get("emailId", uuid.uuid4().hex[:8]))),
        correlationId=correlation_id
    )
    EventNormalizer.persist_and_route(db, canonical)

    return JSONResponse(content={
        "correlationId": correlation_id,
        "source": "gmail",
        "results": [{"eventId": canonical.eventId, "sourceEventId": canonical.sourceEventId, "eventType": canonical.eventType, "status": "normalized"}],
        "pipelineTriggered": True
    })
