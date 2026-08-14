from typing import Dict, Any, List
from sqlalchemy.orm import Session
from app.models.event import CompanyEvent
from app.models.conflict import Conflict
from app.models.agent import AgentProfile


class MemoryStoreService:
    """
    Layer 2: Memory & Context Store.
    Manages short-term operational events, long-term resolved decisions, and company context keys.
    """

    COMPANY_CONTEXT_KEYS = [
        {"key": "default_auth_method", "value": "OAuth2 client credentials"},
        {"key": "release_cadence", "value": "Tuesday & Thursday noon"},
        {"key": "enterprise_onboarding_owner", "value": "Implementation Squad (>25L ACV)"},
        {"key": "primary_db", "value": "PostgreSQL 16"},
        {"key": "vector_store", "value": "pgvector (1536 dims)"},
        {"key": "graph_db", "value": "Neo4j 5.x Community"},
        {"key": "event_bus", "value": "Redis Streams"},
        {"key": "object_storage", "value": "S3 / MinIO"},
        {"key": "orchestrator", "value": "LangGraph"},
        {"key": "workflow_engine", "value": "n8n (Self-Hosted)"},
        {"key": "total_agents", "value": "4"},
        {"key": "embedding_model", "value": "text-embedding-3-small"},
    ]

    @staticmethod
    def get_memory(db: Session) -> Dict[str, Any]:
        events = db.query(CompanyEvent).order_by(CompanyEvent.timestamp.desc()).limit(5).all()
        resolved_conflicts = db.query(Conflict).filter(Conflict.status.in_(["approved", "resolved"])).all()

        short_term = [
            {
                "id": e.id,
                "title": e.title,
                "source": e.source,
                "type": e.event_type_normalized,
                "ts": e.timestamp,
            }
            for e in events
        ]

        long_term = [
            {
                "conflict_id": c.id,
                "title": c.title,
                "status": c.status,
                "owner": c.owner,
            }
            for c in resolved_conflicts
        ]

        return {
            "short_term": short_term,
            "long_term": long_term,
            "company_context": MemoryStoreService.COMPANY_CONTEXT_KEYS,
        }

    @staticmethod
    def get_stats(db: Session) -> Dict[str, Any]:
        events_count = db.query(CompanyEvent).count()
        agents = db.query(AgentProfile).all()
        total_long_term = sum(a.memory_entries for a in agents)

        return {
            "status": "active",
            "short_term_count": events_count,
            "long_term_count": total_long_term,
            "company_context_keys": len(MemoryStoreService.COMPANY_CONTEXT_KEYS),
        }
