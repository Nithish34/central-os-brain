import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.events.schemas import CanonicalEvent
from app.workers.base import BaseWorker
from app.models.event import CompanyEvent
from app.models.document import Document, DocumentChunk
from app.services.tenant_repository import TenantScopedRepository

logger = logging.getLogger(__name__)


def utcnow():
    return datetime.now(timezone.utc)


class KnowledgeWorker(BaseWorker):
    """
    Knowledge Worker for the 'knowledge-workers' consumer group.
    Performs modular pipeline processing:
    1. Content extraction from CanonicalEvent
    2. Deterministic chunk ID computation
    3. Idempotent UPSERT into CompanyEvent and Document/DocumentChunk tables.
    """

    def __init__(self, worker_id: Optional[str] = None):
        super().__init__(consumer_group="knowledge-workers", worker_id=worker_id)

    @staticmethod
    def calculate_chunk_id(organization_id: str, event_id: str, version: str, index: int) -> str:
        seed = f"{organization_id}:{event_id}:{version}:{index}"
        return f"chk_{hashlib.sha256(seed.encode('utf-8')).hexdigest()[:24]}"

    def process_event(self, event: CanonicalEvent, run_id: str, db: Session) -> None:
        """
        Executes idempotent knowledge extraction and vector chunk UPSERT.
        """
        payload = event.payload or {}
        text_content = payload.get("text") or payload.get("body") or payload.get("message") or str(payload)
        author = event.actor.name or event.actor.external_user_id or "System"
        title = payload.get("title") or f"{event.provider.capitalize()} {event.event_type} - {event.event_id[:8]}"

        repo = TenantScopedRepository(db, event.organization_id)

        # 1. UPSERT CompanyEvent
        company_event = db.query(CompanyEvent).filter(
            CompanyEvent.organization_id == event.organization_id,
            CompanyEvent.provider_event_id == event.event_id,
        ).first()

        if not company_event:
            company_event = CompanyEvent(
                id=f"evt_{event.event_id}",
                organization_id=event.organization_id,
                provider_event_id=event.event_id,
                source=event.provider.capitalize(),
                type=event.event_type,
                title=title,
                content=text_content,
                author=author,
                owner=event.source.workspace_id or "Platform",
                timestamp=event.occurred_at.isoformat(),
                authority_score=0.90,
                freshness_score=1.0,
                pipeline_stage="processed",
                event_type_normalized="knowledge_update",
                ingestion_source=f"{event.provider}-worker",
                vector_indexed=True,
            )
            company_event.tags = [event.provider, event.event_type]
            db.add(company_event)
        else:
            company_event.content = text_content
            company_event.author = author
            company_event.title = title
            company_event.freshness_score = 1.0

        # 2. Deterministic Chunking & DocumentChunk UPSERT
        # Split into deterministic 200-char chunks for demonstration
        chunk_size = 200
        raw_chunks = [text_content[i:i + chunk_size] for i in range(0, max(len(text_content), 1), chunk_size)]
        
        # Ensure a parent Document exists for knowledge indexing
        doc_id = f"doc_{event.event_id}"
        document = db.query(Document).filter(
            Document.organization_id == event.organization_id,
            Document.id == doc_id,
        ).first()

        if not document:
            document = Document(
                id=doc_id,
                organization_id=event.organization_id,
                source=event.provider.capitalize(),
                type="event_document",
                title=title,
                content=text_content,
                author=author,
                owner=event.source.workspace_id or "Platform",
                timestamp=event.occurred_at.isoformat(),
                chunk_count=len(raw_chunks),
                status="healthy",
            )
            document.tags = [event.provider, event.event_type]
            db.add(document)
        else:
            document.content = text_content
            document.chunk_count = len(raw_chunks)
            document.status = "healthy"

        # Deterministic Chunk UPSERT
        for idx, chunk_text in enumerate(raw_chunks):
            chunk_id = self.calculate_chunk_id(
                organization_id=event.organization_id,
                event_id=event.event_id,
                version=event.schema_version,
                index=idx,
            )

            existing_chunk = db.query(DocumentChunk).filter(
                DocumentChunk.organization_id == event.organization_id,
                DocumentChunk.id == chunk_id,
            ).first()

            # Deterministic mock embedding vector
            mock_embedding = [0.01 * ((idx + j) % 10) for j in range(16)]

            if not existing_chunk:
                new_chunk = DocumentChunk(
                    id=chunk_id,
                    organization_id=event.organization_id,
                    document_id=doc_id,
                    chunk_index=idx,
                    content=chunk_text,
                    embedding_json=json.dumps(mock_embedding),
                    token_count=len(chunk_text.split()),
                )
                db.add(new_chunk)
            else:
                existing_chunk.content = chunk_text
                existing_chunk.embedding_json = json.dumps(mock_embedding)

        db.commit()
        logger.info(
            f"[KnowledgeWorker] Upserted event {event.event_id} with {len(raw_chunks)} deterministic chunks (run={run_id})"
        )
