import json
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, Integer, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


def utcnow():
    return datetime.now(timezone.utc)


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(64), primary_key=True, index=True)
    organization_id = Column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    source = Column(String(64), nullable=False, index=True)  # Notion, Confluence, etc.
    type = Column(String(64), default="official_document", nullable=False)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    author = Column(String(255), nullable=False)
    owner = Column(String(255), nullable=False, index=True)
    timestamp = Column(String(64), nullable=False)
    authority_score = Column(Float, default=0.8, nullable=False)
    freshness_score = Column(Float, default=0.5, nullable=False)
    status = Column(String(32), default="stale", nullable=False, index=True)  # healthy, stale, review_required
    _tags = Column("tags", Text, default="[]", nullable=False)
    
    # Layer 1 metadata
    chunk_count = Column(Integer, default=4, nullable=False)
    graph_node_id = Column(String(128), nullable=True)
    embedding_model = Column(String(128), default="text-embedding-3-small", nullable=False)
    storage_backend = Column(String(64), default="postgres", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False)

    organization = relationship("Organization", back_populates="documents")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")
    conflicts = relationship("Conflict", back_populates="document", cascade="all, delete-orphan")

    @property
    def tags(self) -> list[str]:
        try:
            return json.loads(self._tags)
        except Exception:
            return []

    @tags.setter
    def tags(self, value: list[str]) -> None:
        self._tags = json.dumps(value)


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(String(64), primary_key=True, index=True)
    organization_id = Column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    document_id = Column(String(64), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    embedding_json = Column(Text, nullable=True)  # Serialized vector fallback or pgvector
    token_count = Column(Integer, default=128, nullable=False)

    document = relationship("Document", back_populates="chunks")
