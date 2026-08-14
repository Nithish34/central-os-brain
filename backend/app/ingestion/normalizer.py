import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.event import CompanyEvent
from app.models.conflict import Conflict
from app.models.document import Document
from app.ingestion.schemas import CanonicalCompanyEvent, ActorSchema, ContentSchema, ContextSchema, VisibilitySchema
from app.services.layer2_intelligence.rag_engine import RAGEngineService


class EventNormalizer:
    @staticmethod
    def normalize_slack(payload: Dict[str, Any], correlation_id: str, org_id: str = "org-company-brain-demo") -> CanonicalCompanyEvent:
        event = payload.get("event", {})
        msg = event.get("message", event)
        text = msg.get("text", "")
        ts_val = msg.get("ts", event.get("ts", str(datetime.now().timestamp())))
        user_id = msg.get("user", event.get("user", "slack-user"))
        event_id = payload.get("event_id", f"slack-{uuid.uuid4().hex[:8]}")

        return CanonicalCompanyEvent(
            eventId=f"evt-slack-{uuid.uuid4().hex[:8]}",
            organizationId=org_id,
            source="slack",
            sourceEventId=str(event_id),
            eventType="message.created" if event.get("subtype") != "message_changed" else "message.updated",
            actor=ActorSchema(id=user_id, displayName=user_id),
            occurredAt=datetime.now().astimezone().isoformat(timespec="seconds"),
            receivedAt=datetime.now().astimezone().isoformat(timespec="seconds"),
            content=ContentSchema(
                title=f"Slack message in #{event.get('channel', 'general')}",
                text=text,
                summary=text[:140] if text else "Slack decision"
            ),
            context=ContextSchema(
                workspaceId=payload.get("team_id"),
                channelId=event.get("channel"),
                threadId=event.get("thread_ts"),
                messageId=str(ts_val)
            ),
            visibility=VisibilitySchema(type="public"),
            metadata=payload,
            correlationId=correlation_id
        )

    @staticmethod
    def normalize_github(payload: Dict[str, Any], correlation_id: str, org_id: str = "org-company-brain-demo") -> CanonicalCompanyEvent:
        pr = payload.get("pull_request", {})
        repo = payload.get("repository", {})
        action = payload.get("action", "opened")
        sender = payload.get("sender", {})
        
        event_type = f"pull_request.{action}"
        if pr.get("merged"):
            event_type = "pull_request.merged"

        title = pr.get("title", payload.get("head_commit", {}).get("message", "GitHub Event"))
        body = pr.get("body", "")

        return CanonicalCompanyEvent(
            eventId=f"evt-gh-{uuid.uuid4().hex[:8]}",
            organizationId=org_id,
            source="github",
            sourceEventId=str(pr.get("id", payload.get("head_commit", {}).get("id", uuid.uuid4().hex[:8]))),
            eventType=event_type,
            actor=ActorSchema(id=sender.get("login", "github-bot"), displayName=sender.get("login")),
            occurredAt=datetime.now().astimezone().isoformat(timespec="seconds"),
            receivedAt=datetime.now().astimezone().isoformat(timespec="seconds"),
            content=ContentSchema(
                title=f"PR #{pr.get('number', '')}: {title}",
                text=f"{title}\n\n{body}",
                summary=title
            ),
            context=ContextSchema(
                repositoryId=str(repo.get("id", "")),
                repositoryName=repo.get("full_name", "acme-corp/service")
            ),
            sourceUrl=pr.get("html_url"),
            visibility=VisibilitySchema(type="public"),
            metadata={"action": action, "merged": pr.get("merged", False)},
            correlationId=correlation_id
        )

    @staticmethod
    def persist_and_route(db: Session, canonical: CanonicalCompanyEvent) -> CompanyEvent:
        # Create CompanyEvent record
        db_event = CompanyEvent(
            id=canonical.eventId,
            source=canonical.source.capitalize(),
            type=canonical.eventType,
            title=canonical.content.title or "Ingested Event",
            content=canonical.content.text or canonical.content.summary or "",
            author=canonical.actor.displayName or canonical.actor.id,
            owner="Platform Engineering",
            timestamp=canonical.occurredAt,
            authority_score=0.92,
            freshness_score=0.98,
            pipeline_stage="processed",
            event_type_normalized="architecture_decision",
            ingestion_source=f"{canonical.source}-connector",
            vector_indexed=True,
        )
        db_event.tags = ["ingestion", canonical.source, canonical.eventType]
        db.add(db_event)
        db.commit()
        db.refresh(db_event)

        return db_event
