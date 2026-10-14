import time
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.caching import cache_manager, build_cache_key
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.services.layer2_intelligence.multi_agent import MultiAgentService
from app.schemas.agent import AgentsListResponse

router = APIRouter()


@router.get("", response_model=AgentsListResponse, summary="List all domain agents and their detection statistics for organization")
def get_agents(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cache_key = build_cache_key(current_user.organization_id, "agents")
    t0 = time.perf_counter()
    cached = cache_manager.get(cache_key)
    if cached is not None:
        _record_timing(request, "cache", t0)
        return cached

    t_db = time.perf_counter()
    agents = MultiAgentService.get_agent_summaries(db, organization_id=current_user.organization_id)
    result = {"agents": agents}
    _record_timing(request, "db", t_db)

    # Agent stats change only when conflicts are processed; cache for 60s
    cache_manager.set(cache_key, result, ttl=60)
    return result


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _record_timing(request: Request, label: str, t_start: float) -> None:
    """Append a Server-Timing metric to the request state for ServerTimingMiddleware."""
    if not hasattr(request.state, "server_timing"):
        request.state.server_timing = {}
    request.state.server_timing[label] = (time.perf_counter() - t_start) * 1000
