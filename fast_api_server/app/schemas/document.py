from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class DocumentBase(BaseModel):
    id: str
    source: str
    type: str = "official_document"
    title: str
    content: str
    author: str
    owner: str
    timestamp: str
    authority_score: float = 0.8
    freshness_score: float = 0.5
    status: str = "stale"
    tags: List[str] = []
    chunk_count: int = 4
    graph_node_id: Optional[str] = None
    embedding_model: str = "text-embedding-3-small"
    storage_backend: str = "s3"


class DocumentCreate(DocumentBase):
    pass


class DocumentResponse(DocumentBase):
    model_config = ConfigDict(from_attributes=True)


class DocumentsListResponse(BaseModel):
    documents: List[DocumentResponse]
