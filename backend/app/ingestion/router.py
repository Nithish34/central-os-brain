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


@router.post("/simulate", summary="Simulate an incoming real-time operational message event from any connected application")
async def simulate_incoming_event(
    request: Request,
    db: Session = Depends(get_db),
    x_company_organization_id: str = Header(default="org-company-brain-demo"),
):
    try:
        body = await request.json()
    except Exception:
        body = {}

    import random
    from app.ingestion.schemas import CanonicalCompanyEvent, ActorSchema, ContentSchema, ContextSchema

    source = (body.get("source") or "slack").lower()
    
    preset_events = [
        {
            "source": "slack",
            "title": "Slack #engineering-core: OAuth2 Token Rotation Standard",
            "text": "Decision confirmed in Slack: All backend microservices must enforce OAuth2 client credentials with 1-hour token rotation. Basic auth headers are blocked at the gateway.",
            "author": "Priya Raman (Tech Lead)",
            "eventType": "architecture_decision"
        },
        {
            "source": "github",
            "title": "GitHub PR #498: Implement OAuth2 validation filter in payments service",
            "text": "Merged PR #498 by @sanjay-p: Replaces legacy JWT token validation with OAuth2 introspection endpoint in production payment pipeline.",
            "author": "Sanjay P (Senior Engineer)",
            "eventType": "pull_request.merged"
        },
        {
            "source": "gmail",
            "title": "Email: Enterprise Customer Billing Grace Period SLA Confirmation",
            "text": "Official email notification from billing-ops@company.local: Enterprise invoice grace period officially extended from 14 to 30 days. Dunning policy updated in financial systems.",
            "author": "billing-ops@companybrain.local",
            "eventType": "email.received"
        },
        {
            "source": "teams",
            "title": "Teams #sec-ops: Mandatory OIDC OAuth 2.0 PKCE Rollout",
            "text": "CISO directive in Microsoft Teams: Enforce OIDC OAuth 2.0 with PKCE and hardware MFA tokens for all internal portal authentication effective this sprint.",
            "author": "Elena Rostova (CISO)",
            "eventType": "chat_message"
        },
        {
            "source": "jira",
            "title": "Jira PLAT-902: Review and update payment architecture runbook",
            "text": "Task assigned to Platform Engineering: Update payment architecture technical specifications and deprecate legacy JWT auth documentation.",
            "author": "Karthik V (SRE Lead)",
            "eventType": "process_ticket"
        }
    ]

    selected = next((p for p in preset_events if p["source"] == source), random.choice(preset_events))
    
    title = body.get("title") or selected["title"]
    text = body.get("content") or body.get("text") or selected["text"]
    author = body.get("author") or selected["author"]
    event_type = body.get("eventType") or selected["eventType"]
    source_val = body.get("source") or selected["source"]

    correlation_id = f"corr-sim-{uuid.uuid4().hex[:8]}"
    event_id = f"evt-{source_val}-{uuid.uuid4().hex[:8]}"

    canonical = CanonicalCompanyEvent(
        eventId=event_id,
        organizationId=x_company_organization_id,
        source=source_val,
        sourceEventId=str(uuid.uuid4().hex[:8]),
        eventType=event_type,
        actor=ActorSchema(id=author, displayName=author),
        occurredAt=datetime.now().astimezone().isoformat(timespec="seconds"),
        receivedAt=datetime.now().astimezone().isoformat(timespec="seconds"),
        content=ContentSchema(
            title=title,
            text=text,
            summary=text[:140]
        ),
        context=ContextSchema(channelId="general"),
        correlationId=correlation_id
    )

    db_event = EventNormalizer.persist_and_route(db, canonical)

    return JSONResponse(content={
        "ok": True,
        "event": {
            "id": db_event.id,
            "source": db_event.source,
            "title": db_event.title,
            "content": db_event.content,
            "author": db_event.author,
            "timestamp": db_event.timestamp,
            "pipeline_stage": db_event.pipeline_stage,
            "type": db_event.event_type_normalized,
        },
        "pipelineTriggered": True,
        "message": f"Real-time event from {source_val.capitalize()} successfully ingested and piped into Layer 3 Event Bus and Layer 2 Contradiction Engine."
    })
