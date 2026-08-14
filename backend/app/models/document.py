import json
from datetime import datetime
from sqlalchemy import Column, String, Float, Integer, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class Document(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, index=True)
    source = Column(String, nullable=False, index=True)  # Notion, Confluence, etc.
    type = Column(String, default="official_document")
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    author = Column(String, nullable=False)
    owner = Column(String, nullable=False, index=True)
    timestamp = Column(String, nullable=False)
    authority_score = Column(Float, default=0.8)
    freshness_score = Column(Float, default=0.5)
    status = Column(String, default="stale", index=True)  # healthy, stale, review_required
    _tags = Column("tags", Text, default="[]")
    
    # Layer 1 metadata
    chunk_count = Column(Integer, default=4)
    graph_node_id = Column(String, nullable=True)
    embedding_model = Column(String, default="text-embedding-3-small")
    storage_backend = Column(String, default="s3")

    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")

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

    id = Column(String, primary_key=True, index=True)
    document_id = Column(String, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    embedding_json = Column(Text, nullable=True)  # Serialized vector for fallback, or pgvector
    token_count = Column(Integer, default=128)

    document = relationship("Document", back_populates="chunks")
