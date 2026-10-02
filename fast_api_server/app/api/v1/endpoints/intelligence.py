from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.layer2_intelligence.rag_engine import RAGEngineService
from app.services.layer2_intelligence.conflict_detector import ConflictDetectorService
from app.services.layer2_intelligence.memory_store import MemoryStoreService
from app.services.layer1_data.vector_store import KnowledgeGraphStoreService
from app.schemas.intelligence import IntelligenceHealthResponse, MemoryResponse

router = APIRouter()


@router.get("/health", response_model=IntelligenceHealthResponse, summary="Layer 2 Intelligence Core operational health")
def get_intelligence_health(db: Session = Depends(get_db)):
    rag_stats = RAGEngineService.get_stats(db)
    kg_stats = KnowledgeGraphStoreService.get_stats(db)
    cd_stats = ConflictDetectorService.get_stats(db)
    mem_stats = MemoryStoreService.get_stats(db)

    from datetime import datetime
    kg_stats["last_updated"] = datetime.now().astimezone().isoformat(timespec="seconds")

    return {
        "rag_engine": rag_stats,
        "knowledge_graph": kg_stats,
        "conflict_detection": cd_stats,
        "memory_store": mem_stats,
    }


@router.get("/memory", response_model=MemoryResponse, summary="Layer 2 Context & Memory store contents")
def get_memory(db: Session = Depends(get_db)):
    return MemoryStoreService.get_memory(db)
