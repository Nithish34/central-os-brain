from typing import List, Dict, Any
from pydantic import BaseModel


class RAGEngineStats(BaseModel):
    status: str = "active"
    documents_indexed: int
    total_chunks: int
    events_indexed: int
    embedding_model: str = "text-embedding-3-small"
    embedding_dims: int = 1536
    hybrid_search: bool = True
    reranking: bool = True


class KnowledgeGraphStats(BaseModel):
    status: str = "active"
    backend: str = "Neo4j"
    nodes: int
    edges: int
    last_updated: str


class ConflictDetectionStats(BaseModel):
    status: str = "active"
    last_run: str
    conflicts_found: int
    total_processed: int
    avg_contradiction: float


class MemoryStoreStats(BaseModel):
    status: str = "active"
    short_term_count: int
    long_term_count: int
    company_context_keys: int


class IntelligenceHealthResponse(BaseModel):
    rag_engine: RAGEngineStats
    knowledge_graph: KnowledgeGraphStats
    conflict_detection: ConflictDetectionStats
    memory_store: MemoryStoreStats


class MemoryShortTermItem(BaseModel):
    id: str
    title: str
    source: str
    type: str
    ts: str


class MemoryLongTermItem(BaseModel):
    conflict_id: str
    title: str
    status: str
    owner: str


class CompanyContextKey(BaseModel):
    key: str
    value: str


class MemoryResponse(BaseModel):
    short_term: List[MemoryShortTermItem]
    long_term: List[MemoryLongTermItem]
    company_context: List[CompanyContextKey]


class KnowledgeHealthMetrics(BaseModel):
    knowledge_health: int
    total_documents: int
    total_events: int
    open_conflicts: int
    resolved_conflicts: int
    stale_documents: int
    automated_workflows: int
    last_scan: str
