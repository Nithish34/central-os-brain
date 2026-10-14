import time
from datetime import datetime
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.caching import cache_manager, build_cache_key
from app.services.layer2_intelligence.rag_engine import RAGEngineService
from app.services.layer2_intelligence.conflict_detector import ConflictDetectorService
from app.services.layer2_intelligence.memory_store import MemoryStoreService
from app.services.layer1_data.vector_store import KnowledgeGraphStoreService
from app.schemas.intelligence import IntelligenceHealthResponse, MemoryResponse

router = APIRouter()

# Global (non-tenant) keys — intelligence stats are org-independent service metrics
_INTEL_HEALTH_CACHE_KEY = "cb:cache:global:intelligence_health:all"
_MEMORY_CACHE_KEY = "cb:cache:global:intelligence_memory:all"


@router.get("/health", response_model=IntelligenceHealthResponse, summary="Layer 2 Intelligence Core operational health")
def get_intelligence_health(
    request: Request,
    db: Session = Depends(get_db),
):
    t0 = time.perf_counter()
    cached = cache_manager.get(_INTEL_HEALTH_CACHE_KEY)
    if cached is not None:
        _record_timing(request, "cache", t0)
        return cached

    t_db = time.perf_counter()
    rag_stats = RAGEngineService.get_stats(db)
    kg_stats = KnowledgeGraphStoreService.get_stats(db)
    cd_stats = ConflictDetectorService.get_stats(db)
    mem_stats = MemoryStoreService.get_stats(db)
    _record_timing(request, "db", t_db)

    kg_stats["last_updated"] = datetime.now().astimezone().isoformat(timespec="seconds")

    result = {
        "rag_engine": rag_stats,
        "knowledge_graph": kg_stats,
        "conflict_detection": cd_stats,
        "memory_store": mem_stats,
    }

    cache_manager.set(_INTEL_HEALTH_CACHE_KEY, result, ttl=30)
    return result


@router.get("/memory", response_model=MemoryResponse, summary="Layer 2 Context & Memory store contents")
def get_memory(
    request: Request,
    db: Session = Depends(get_db),
):
    t0 = time.perf_counter()
    cached = cache_manager.get(_MEMORY_CACHE_KEY)
    if cached is not None:
        _record_timing(request, "cache", t0)
        return cached

    t_db = time.perf_counter()
    result = MemoryStoreService.get_memory(db)
    _record_timing(request, "db", t_db)

    cache_manager.set(_MEMORY_CACHE_KEY, result, ttl=30)
    return result


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _record_timing(request: Request, label: str, t_start: float) -> None:
    """Append a Server-Timing metric to the request state for ServerTimingMiddleware."""
    if not hasattr(request.state, "server_timing"):
        request.state.server_timing = {}
    request.state.server_timing[label] = (time.perf_counter() - t_start) * 1000
