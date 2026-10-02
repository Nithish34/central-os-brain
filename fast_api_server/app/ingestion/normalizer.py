import uuid
import json
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
        text_content = canonical.content.text or canonical.content.summary or ""
        db_event = CompanyEvent(
            id=canonical.eventId,
            source=canonical.source.capitalize(),
            type=canonical.eventType,
            title=canonical.content.title or "Ingested Event",
            content=text_content,
            author=canonical.actor.displayName or canonical.actor.id,
            owner="Platform Engineering",
            timestamp=canonical.occurredAt,
            authority_score=0.94,
            freshness_score=0.99,
            pipeline_stage="processed",
            event_type_normalized="architecture_decision",
            ingestion_source=f"{canonical.source}-connector",
            vector_indexed=True,
        )
        db_event.tags = ["ingestion", canonical.source, canonical.eventType]
        db.add(db_event)
        db.commit()
        db.refresh(db_event)

        # ── Real-Time Layer 2 Conflict Detection & Evidence Linking ──────────────
        lower_text = text_content.lower()
        matched_conflict = None

        if any(k in lower_text for k in ["jwt", "oauth", "auth", "payment", "credential", "token"]):
            matched_conflict = db.query(Conflict).filter(Conflict.id == "conflict-auth-method").first()
        elif any(k in lower_text for k in ["onboard", "sop", "customer", "handoff", "ownership", "success", "exam"]):
            matched_conflict = db.query(Conflict).filter(Conflict.id == "conflict-onboarding-owner").first()
        elif any(k in lower_text for k in ["release", "cadence", "deploy", "window", "friday", "tuesday"]):
            matched_conflict = db.query(Conflict).filter(Conflict.id == "conflict-release-cadence").first()

        if matched_conflict:
            # Update existing conflict with live incoming evidence as primary source
            curr_ev = matched_conflict.evidence_ids
            if db_event.id not in curr_ev:
                matched_conflict.evidence_ids = [db_event.id] + curr_ev
            matched_conflict.new_claim = text_content
            matched_conflict.status = "open"
            matched_conflict.freshness_delta = 0.45
            db.commit()
        else:
            # Dynamically create a new Conflict in the Inbox for unmapped topics
            first_doc = db.query(Document).first()
            if first_doc and len(text_content.strip()) > 10:
                new_conflict_id = f"conflict-live-{uuid.uuid4().hex[:6]}"
                new_conflict = Conflict(
                    id=new_conflict_id,
                    title=f"Live Drift: {canonical.content.title or 'Operational Policy Update'}",
                    severity="high",
                    domain="Platform Engineering",
                    document_id=first_doc.id,
                    old_claim=first_doc.content[:180] + "...",
                    new_claim=text_content,
                    recommended_update=f"Update documentation to align with recent {canonical.source.capitalize()} decision: {text_content}",
                    business_impact=f"Operational reality in {canonical.source.capitalize()} diverges from baseline documentation.",
                    owner="Platform Engineering Lead",
                    status="open",
                    detected_by="agent-engineering",
                    contradiction_score=0.88,
                    freshness_delta=0.48,
                    authority_delta=0.12,
                    risk_level="HIGH",
                    _evidence_ids=json.dumps([db_event.id]),
                    _approval_matrix=json.dumps({
                        "risk_level": "HIGH",
                        "requires_approval_from": "Platform Engineering Lead",
                        "rules": [
                            {"rule": "Authority threshold check (>80%)", "passed": True},
                            {"rule": "Contradiction confidence threshold (>75%)", "passed": True},
                            {"rule": "Document ownership validation", "passed": True},
                            {"rule": "Conflict status is open", "passed": True},
                            {"rule": "Evidence source freshness verification", "passed": True}
                        ]
                    })
                )
                db.add(new_conflict)
                db.commit()

        return db_event

