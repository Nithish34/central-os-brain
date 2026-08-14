import json
from pathlib import Path
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db, Base, engine
from app.models.document import Document, DocumentChunk
from app.models.event import CompanyEvent
from app.models.conflict import Conflict
from app.models.agent import AgentProfile
from app.models.audit import AuditLog
from app.models.workflow import WorkflowAction
from app.core.config import ROOT_DIR

router = APIRouter()
DATA_DIR = ROOT_DIR / "data"


def load_json(name: str):
    with (DATA_DIR / name).open("r", encoding="utf-8") as f:
        return json.load(f)


def reset_and_seed_db(db: Session):
    # Clear all tables
    db.query(WorkflowAction).delete()
    db.query(AuditLog).delete()
    db.query(Conflict).delete()
    db.query(CompanyEvent).delete()
    db.query(DocumentChunk).delete()
    db.query(Document).delete()
    db.query(AgentProfile).delete()
    db.commit()

    # Seed Documents
    docs_data = load_json("documents.json")
    for d in docs_data:
        doc = Document(
            id=d["id"],
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
            storage_backend=d.get("storage_backend", "s3"),
        )
        doc.tags = d.get("tags", [])
        db.add(doc)

        # Generate sample chunks
        for i in range(doc.chunk_count):
            chunk = DocumentChunk(
                id=f"chunk-{doc.id}-{i}",
                document_id=doc.id,
                chunk_index=i,
                content=f"Chunk {i+1} content for {doc.title}...",
                token_count=128,
            )
            db.add(chunk)

    # Seed Events
    events_data = load_json("events.json")
    for e in events_data:
        evt = CompanyEvent(
            id=e["id"],
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

    # Seed Conflicts
    conflicts_data = load_json("conflicts.json")
    for c in conflicts_data:
        conf = Conflict(
            id=c["id"],
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

    # Seed Agents
    agents_data = load_json("agents.json")
    for a in agents_data:
        agent = AgentProfile(
            id=a["id"],
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
    reset_and_seed_db(db)
    return {"ok": True, "message": "Prototype state successfully reset to initial baseline"}
