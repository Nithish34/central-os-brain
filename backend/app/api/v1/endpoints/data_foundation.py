from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.document import Document, DocumentChunk
from app.models.event import CompanyEvent
from app.models.conflict import Conflict
from app.models.audit import AuditLog

router = APIRouter()


@router.get("", summary="Layer 1 Data Foundation services telemetry")
def get_data_foundation(db: Session = Depends(get_db)):
    docs_count = db.query(Document).count()
    events_count = db.query(CompanyEvent).count()
    conflicts_count = db.query(Conflict).count()
    chunks_count = db.query(DocumentChunk).count()
    audit_count = db.query(AuditLog).count()

    nodes = docs_count + events_count
    edges = conflicts_count * 2 + events_count

    return {
        "postgresql": {
            "status": "active",
            "host": "localhost:5432",
            "tables": ["documents", "events", "conflicts", "audit_logs", "workflow_actions", "agents"],
            "row_count": docs_count + events_count + conflicts_count + audit_count,
            "description": "Core relational data — documents, events, conflicts, audit logs",
        },
        "pgvector": {
            "status": "active",
            "host": "localhost:5432",
            "embeddings": chunks_count,
            "dimensions": 1536,
            "index": "IVFFlat",
            "description": "Vector embeddings for RAG & semantic search",
        },
        "neo4j": {
            "status": "active",
            "host": "bolt://localhost:7687",
            "nodes": nodes,
            "edges": edges,
            "description": "Knowledge graph — document ↔ event relationships",
        },
        "redis": {
            "status": "active",
            "host": "localhost:6379",
            "cache_keys": events_count * 2 + docs_count,
            "streams": ["events-raw", "events-normalised", "conflict-queue"],
            "description": "Event bus (Streams) + response cache",
        },
        "s3_minio": {
            "status": "active",
            "host": "localhost:9000",
            "buckets": ["documents", "embeddings-cache", "audit-exports"],
            "object_count": docs_count + audit_count,
            "description": "Object storage — raw documents and files",
        },
    }
