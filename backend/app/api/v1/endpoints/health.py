from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.document import Document
from app.models.event import CompanyEvent
from app.models.conflict import Conflict
from app.models.workflow import WorkflowAction
from app.schemas.intelligence import KnowledgeHealthMetrics

router = APIRouter()


@router.get("/health", summary="Basic service health check")
def get_health():
    return {"status": "ok", "service": "Company Brain OS Prototype"}


@router.get("/knowledge/health", response_model=KnowledgeHealthMetrics, summary="Overall knowledge health metrics")
def get_knowledge_health(db: Session = Depends(get_db)):
    documents = db.query(Document).all()
    conflicts = db.query(Conflict).all()
    events_count = db.query(CompanyEvent).count()
    workflows_count = db.query(WorkflowAction).count()

    open_c = [c for c in conflicts if c.status == "open"]
    resolved = [c for c in conflicts if c.status in {"approved", "resolved"}]
    stale = [d for d in documents if d.status != "healthy"]

    avg_fresh = round(
        sum(d.freshness_score for d in documents) / max(len(documents), 1) * 100
    )
    health = max(0, min(100, round(avg_fresh - len(open_c) * 7 + len(resolved) * 4)))

    return KnowledgeHealthMetrics(
        knowledge_health=health,
        total_documents=len(documents),
        total_events=events_count,
        open_conflicts=len(open_c),
        resolved_conflicts=len(resolved),
        stale_documents=len(stale),
        automated_workflows=workflows_count,
        last_scan=datetime.now().astimezone().isoformat(timespec="seconds"),
    )
