import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Body, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.caching import cache_manager, build_cache_key
from app.models.user import User, UserRole
from app.auth.dependencies import get_current_user, require_role
from app.services.layer1_data.db_service import DataService
from app.services.layer2_intelligence.conflict_detector import ConflictDetectorService
from app.services.layer0_execution.policy_engine import PolicyEngineService
from app.services.layer0_execution.action_executor import ActionExecutorService
from app.schemas.conflict import (
    ConflictsListResponse,
    SingleConflictResponse,
    ConflictApprovalRequest,
    ConflictRejectionRequest,
)
from app.schemas.pipeline import RiskCheckResponse

router = APIRouter()


@router.get("", response_model=ConflictsListResponse, summary="List all detected conflicts for organization")
def get_conflicts(
    request: Request,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cache_key = build_cache_key(current_user.organization_id, "conflicts", extra=status or "all")
    t0 = time.perf_counter()
    cached = cache_manager.get(cache_key)
    if cached is not None:
        _record_timing(request, "cache", t0)
        return cached

    t_db = time.perf_counter()
    conflicts = DataService.get_conflicts(db, status=status, organization_id=current_user.organization_id)
    enriched = [ConflictDetectorService.enrich_conflict(db, c) for c in conflicts]
    result = {"conflicts": enriched}
    _record_timing(request, "db", t_db)

    cache_manager.set(cache_key, result, ttl=30)
    return result


@router.get("/{conflict_id}", response_model=SingleConflictResponse, summary="Get conflict detail within organization")
def get_conflict(
    conflict_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cache_key = build_cache_key(current_user.organization_id, "conflicts", extra=conflict_id)
    t0 = time.perf_counter()
    cached = cache_manager.get(cache_key)
    if cached is not None:
        _record_timing(request, "cache", t0)
        return cached

    t_db = time.perf_counter()
    conflict = DataService.get_conflict_by_id(db, conflict_id, organization_id=current_user.organization_id)
    _record_timing(request, "db", t_db)

    if not conflict:
        raise HTTPException(status_code=404, detail="Conflict not found")
    enriched = ConflictDetectorService.enrich_conflict(db, conflict)
    result = {"conflict": enriched}

    cache_manager.set(cache_key, result, ttl=60)
    return result


@router.get("/{conflict_id}/risk-check", response_model=RiskCheckResponse, summary="Run Layer 0 pre-approval risk check")
def evaluate_conflict_risk(
    conflict_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conflict = DataService.get_conflict_by_id(db, conflict_id, organization_id=current_user.organization_id)
    if not conflict:
        raise HTTPException(status_code=404, detail="Conflict not found")
    status_code, payload = PolicyEngineService.evaluate_risk(db, conflict_id)
    if status_code != 200:
        raise HTTPException(status_code=status_code, detail=payload.get("error", "Error"))
    return payload


@router.post("/{conflict_id}/approve", summary="Approve conflict update within organization")
def approve_conflict(
    conflict_id: str,
    body: ConflictApprovalRequest = Body(default=ConflictApprovalRequest()),
    current_user: User = Depends(require_role(UserRole.MANAGER.value)),
    db: Session = Depends(get_db),
):
    conflict = DataService.get_conflict_by_id(db, conflict_id, organization_id=current_user.organization_id)
    if not conflict:
        raise HTTPException(status_code=404, detail="Conflict not found")
    status_code, payload = ActionExecutorService.apply_approval(db, conflict_id, "approve", body.reason)
    if status_code != 200:
        raise HTTPException(status_code=status_code, detail=payload.get("error", "Error"))

    # Invalidate cached conflicts so reads get fresh state
    cache_manager.invalidate_tenant(current_user.organization_id, "conflicts")
    return payload


@router.post("/{conflict_id}/reject", summary="Reject conflict update within organization")
def reject_conflict(
    conflict_id: str,
    body: ConflictRejectionRequest = Body(default=ConflictRejectionRequest()),
    current_user: User = Depends(require_role(UserRole.MANAGER.value)),
    db: Session = Depends(get_db),
):
    conflict = DataService.get_conflict_by_id(db, conflict_id, organization_id=current_user.organization_id)
    if not conflict:
        raise HTTPException(status_code=404, detail="Conflict not found")
    status_code, payload = ActionExecutorService.apply_approval(db, conflict_id, "reject", body.reason)
    if status_code != 200:
        raise HTTPException(status_code=status_code, detail=payload.get("error", "Error"))

    # Invalidate cached conflicts so reads get fresh state
    cache_manager.invalidate_tenant(current_user.organization_id, "conflicts")
    return payload


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _record_timing(request: Request, label: str, t_start: float) -> None:
    """Append a Server-Timing metric to the request state for ServerTimingMiddleware."""
    if not hasattr(request.state, "server_timing"):
        request.state.server_timing = {}
    request.state.server_timing[label] = (time.perf_counter() - t_start) * 1000
