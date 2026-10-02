import json
from pathlib import Path
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.organization import Organization
from app.models.user import User, UserRole
from app.models.document import Document, DocumentChunk
from app.models.event import CompanyEvent
from app.models.conflict import Conflict
from app.models.agent import AgentProfile
from app.models.audit import AuditLog
from app.models.workflow import WorkflowAction
from app.models.integration import IntegrationAccount
from app.core.config import ROOT_DIR, settings
from app.core.security import hash_password

router = APIRouter()
DATA_DIR = ROOT_DIR / "data"


def load_json(name: str):
    file_path = DATA_DIR / name
    if not file_path.exists():
        return []
    with file_path.open("r", encoding="utf-8") as f:
        return json.load(f)


def reset_and_seed_db(db: Session, org_id: str = "org-default"):
    # Ensure org exists
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        org = Organization(
            id=org_id,
            name="Acme Corp Demo",
            slug="default",
            domain="companybrain.local",
            plan="enterprise",
        )
        db.add(org)
        db.commit()

    # Clear org-scoped records
    db.query(WorkflowAction).filter(WorkflowAction.organization_id == org_id).delete()
    db.query(AuditLog).filter(AuditLog.organization_id == org_id).delete()
    db.query(Conflict).filter(Conflict.organization_id == org_id).delete()
    db.query(CompanyEvent).filter(CompanyEvent.organization_id == org_id).delete()
    db.query(DocumentChunk).filter(DocumentChunk.organization_id == org_id).delete()
    db.query(Document).filter(Document.organization_id == org_id).delete()
    db.query(AgentProfile).filter(AgentProfile.organization_id == org_id).delete()
    db.commit()

    # 1. Seed Documents
    docs_data = load_json("documents.json")
    for d in docs_data:
        doc = Document(
            id=d["id"],
            organization_id=org_id,
            source=d["source"],
            type=d.get("type", "official_document"),
            title=d["title"],
            content=d["content"],
            author=d["author"],
            owner=d["owner"],
            timestamp=d["timestamp"],
            authority_score=d.get("authority_score", 0.8),
            freshness_score=d.get("freshness_score", 0.5),
            status=d.get("status", "stale"),
            chunk_count=d.get("chunk_count", 4),
            graph_node_id=d.get("graph_node_id"),
            embedding_model=d.get("embedding_model", "text-embedding-3-small"),
            storage_backend=d.get("storage_backend", "postgres"),
        )
        doc.tags = d.get("tags", [])
        db.add(doc)
    db.commit()

    # 2. Seed Document Chunks
    for d in docs_data:
        chunk_count = d.get("chunk_count", 4)
        for i in range(chunk_count):
            chunk = DocumentChunk(
                id=f"chunk-{d['id']}-{i}",
                organization_id=org_id,
                document_id=d["id"],
                chunk_index=i,
                content=f"Chunk {i+1} content for {d['title']}...",
                token_count=128,
            )
            db.add(chunk)
    db.commit()

    # 3. Seed Events
    events_data = load_json("events.json")
    for e in events_data:
        evt = CompanyEvent(
            id=e["id"],
            organization_id=org_id,
            provider_event_id=e.get("id"),
            source=e["source"],
            type=e["type"],
            title=e["title"],
            content=e["content"],
            author=e["author"],
            owner=e["owner"],
            timestamp=e["timestamp"],
            authority_score=e.get("authority_score", 0.85),
            freshness_score=e.get("freshness_score", 0.95),
            pipeline_stage=e.get("pipeline_stage", "processed"),
            event_type_normalized=e.get("event_type_normalized", "operational_decision"),
            ingestion_source=e.get("ingestion_source", "connector"),
            vector_indexed=e.get("vector_indexed", True),
        )
        evt.tags = e.get("tags", [])
        db.add(evt)
    db.commit()

    # 4. Seed Conflicts
    conflicts_data = load_json("conflicts.json")
    for c in conflicts_data:
        conf = Conflict(
            id=c["id"],
            organization_id=org_id,
            title=c["title"],
            severity=c.get("severity", "medium"),
            domain=c["domain"],
            document_id=c["document_id"],
            old_claim=c["old_claim"],
            new_claim=c["new_claim"],
            recommended_update=c["recommended_update"],
            business_impact=c["business_impact"],
            owner=c["owner"],
            status=c.get("status", "open"),
            detected_by=c.get("detected_by", "agent-engineering"),
            contradiction_score=c.get("contradiction_score", 0.85),
            freshness_delta=c.get("freshness_delta", 0.4),
            authority_delta=c.get("authority_delta", 0.05),
            graph_hops=c.get("graph_hops", 1),
            risk_level=c.get("risk_level", "MEDIUM"),
        )
        conf.evidence_ids = c.get("evidence_ids", [])
        conf.approval_matrix = c.get("approval_matrix", {})
        db.add(conf)
    db.commit()

    # 5. Seed Agents
    agents_data = load_json("agents.json")
    for a in agents_data:
        agent = AgentProfile(
            id=a["id"],
            organization_id=org_id,
            name=a["name"],
            icon=a.get("icon", "🤖"),
            domain=a["domain"],
            status=a.get("status", "active"),
            conflicts_detected=a.get("conflicts_detected", 0),
            last_detection=a.get("last_detection"),
            memory_entries=a.get("memory_entries", 10),
            tasks_completed=a.get("tasks_completed", 0),
            description=a["description"],
        )
        agent.detected_conflict_ids = a.get("detected_conflict_ids", [])
        db.add(agent)
    db.commit()


@router.post("/reset", summary="Reset prototype database to baseline fixture state")
def reset_demo(db: Session = Depends(get_db)):
    reset_and_seed_db(db, "org-default")
    return {"ok": True, "message": "Prototype state successfully reset to initial baseline"}
