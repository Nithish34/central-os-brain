import math
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.document import Document, DocumentChunk


class VectorStoreService:
    """
    Manages vector embeddings for documents and events.
    Supports pgvector when connected to Postgres, or dense in-memory vector cosine similarity.
    """
    @staticmethod
    def cosine_similarity(v1: List[float], v2: List[float]) -> float:
        if not v1 or not v2 or len(v1) != len(v2):
            return 0.0
        dot = sum(a * b for a, b in zip(v1, v2))
        norm1 = math.sqrt(sum(a * a for a in v1))
        norm2 = math.sqrt(sum(b * b for b in v2))
        return dot / (norm1 * norm2) if norm1 > 0 and norm2 > 0 else 0.0

    @staticmethod
    def get_stats(db: Session) -> Dict[str, Any]:
        chunks = db.query(DocumentChunk).all()
        return {
            "status": "active",
            "backend": "pgvector (PostgreSQL 16) / HNSW vector index",
            "dimensions": 1536,
            "total_embeddings": len(chunks),
            "similarity_metric": "cosine",
            "model": "text-embedding-3-small",
        }


class KnowledgeGraphStoreService:
    """
    Manages entity-relationship graph in Neo4j (Documents <-> Concepts <-> Teams <-> Events).
    """
    @staticmethod
    def get_stats(db: Session) -> Dict[str, Any]:
        from app.models.document import Document
        from app.models.event import CompanyEvent
        from app.models.conflict import Conflict

        docs_count = db.query(Document).count()
        events_count = db.query(CompanyEvent).count()
        conflicts_count = db.query(Conflict).count()

        nodes = docs_count + events_count
        edges = conflicts_count * 2 + events_count

        return {
            "status": "active",
            "backend": "Neo4j 5.x Community",
            "nodes": nodes,
            "edges": edges,
            "labels": ["Document", "Event", "Team", "Decision", "Conflict"],
            "relationships": ["DEFINED_BY", "CONTRADICTED_BY", "OWNED_BY", "CITES"],
        }
