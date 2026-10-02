from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import get_db
from app.core.redis import redis_client
from app.models.document import Document
from app.models.event import CompanyEvent
from app.models.conflict import Conflict
from app.models.workflow import WorkflowAction
from app.models.user import User
from app.schemas.intelligence import KnowledgeHealthMetrics
from app.auth.dependencies import get_current_user, get_tenant_repo
from app.services.tenant_repository import TenantScopedRepository

router = APIRouter()


@router.get("/health", summary="Readiness & liveness health check probe for DB and Redis")
def get_health(response: Response, db: Session = Depends(get_db)):
    # 1. Test database connection
    db_status = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception as e:
        db_status = f"error: {str(e)}"

    # 2. Test redis connection
    redis_ok = redis_client.ping()
    redis_status = "ok" if redis_ok else "error: ping failed"

    is_healthy = (db_status == "ok" and redis_ok)
    if not is_healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "ok" if is_healthy else "degraded",
        "database": db_status,
        "redis": redis_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/knowledge/health", response_model=KnowledgeHealthMetrics, summary="Overall knowledge health metrics")
def get_knowledge_health(
    current_user: Optional[User] = Depends(get_current_user),
    tenant_repo: TenantScopedRepository = Depends(get_tenant_repo),
):
    documents = tenant_repo.query(Document).all()
    conflicts = tenant_repo.query(Conflict).all()
    events_count = tenant_repo.query(CompanyEvent).count()
    workflows_count = tenant_repo.query(WorkflowAction).count()

    open_c = [c for c in conflicts if c.status == "open"]
    resolved = [c for c in conflicts if c.status in {"approved", "resolved"}]
    stale = [d for d in documents if d.status != "healthy"]

    avg_fresh = round(
        sum(d.freshness_score for d in documents) / max(len(documents), 1) * 100
    ) if documents else 100
    health = max(0, min(100, round(avg_fresh - len(open_c) * 7 + len(resolved) * 4)))

    return KnowledgeHealthMetrics(
        knowledge_health=health,
        total_documents=len(documents),
        total_events=events_count,
        open_conflicts=len(open_c),
        resolved_conflicts=len(resolved),
        stale_documents=len(stale),
        automated_workflows=workflows_count,
        last_scan=datetime.now(timezone.utc).isoformat(),
    )
