from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.core.database import get_db
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


@router.get("", response_model=ConflictsListResponse, summary="List all detected conflicts with enriched intelligence")
def get_conflicts(status: Optional[str] = None, db: Session = Depends(get_db)):
    conflicts = DataService.get_conflicts(db, status=status)
    enriched = [ConflictDetectorService.enrich_conflict(db, c) for c in conflicts]
    return {"conflicts": enriched}


@router.get("/{conflict_id}", response_model=SingleConflictResponse, summary="Get conflict detail with evidence and confidence scores")
def get_conflict(conflict_id: str, db: Session = Depends(get_db)):
    conflict = DataService.get_conflict_by_id(db, conflict_id)
    if not conflict:
        raise HTTPException(status_code=404, detail="Conflict not found")
    enriched = ConflictDetectorService.enrich_conflict(db, conflict)
    return {"conflict": enriched}


@router.get("/{conflict_id}/risk-check", response_model=RiskCheckResponse, summary="Run Layer 0 pre-approval risk and policy verification")
def evaluate_conflict_risk(conflict_id: str, db: Session = Depends(get_db)):
    status_code, payload = PolicyEngineService.evaluate_risk(db, conflict_id)
    if status_code != 200:
        raise HTTPException(status_code=status_code, detail=payload.get("error", "Error"))
    return payload


@router.get("/risk-check/{conflict_id}", response_model=RiskCheckResponse, include_in_schema=False)
def evaluate_conflict_risk_alias(conflict_id: str, db: Session = Depends(get_db)):
    return evaluate_conflict_risk(conflict_id, db)


@router.post("/{conflict_id}/approve", summary="Approve conflict update and execute Layer 0 workflows")
def approve_conflict(
    conflict_id: str,
    body: ConflictApprovalRequest = Body(default=ConflictApprovalRequest()),
    db: Session = Depends(get_db),
):
    status_code, payload = ActionExecutorService.apply_approval(db, conflict_id, "approve", body.reason)
    if status_code != 200:
        raise HTTPException(status_code=status_code, detail=payload.get("error", "Error"))
    return payload


@router.post("/{conflict_id}/reject", summary="Reject conflict update")
def reject_conflict(
    conflict_id: str,
    body: ConflictRejectionRequest = Body(default=ConflictRejectionRequest()),
    db: Session = Depends(get_db),
):
    status_code, payload = ActionExecutorService.apply_approval(db, conflict_id, "reject", body.reason)
    if status_code != 200:
        raise HTTPException(status_code=status_code, detail=payload.get("error", "Error"))
    return payload
