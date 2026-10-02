import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User, UserRole
from app.models.canonical_event import CanonicalEventModel
from app.models.event_outbox import EventOutbox
from app.models.event_processing import EventProcessingState
from app.models.event_dead_letter import EventDeadLetter
from app.events.bus import RedisEventBus, event_bus, DEFAULT_CONSUMER_GROUPS
from app.events.retry import DeadLetterService
from app.events.replay import EventReplayService
from app.auth.dependencies import get_current_user, require_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/operations", tags=["Phase 4 — Operations & Event Platform Observability"])


class ReplayRequest(BaseModel):
    reason: str = Field(..., description="Audit reason for requesting replay")
    provider: Optional[str] = None
    event_type: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    limit: int = Field(default=1000, le=5000)


@router.get("/events", summary="List historical canonical events ledger")
def list_canonical_events(
    provider: Optional[str] = None,
    event_type: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_role(UserRole.MANAGER.value)),
    db: Session = Depends(get_db),
):
    query = db.query(CanonicalEventModel).filter(
        CanonicalEventModel.organization_id == current_user.organization_id
    )
    if provider:
        query = query.filter(CanonicalEventModel.provider == provider.lower())
    if event_type:
        query = query.filter(CanonicalEventModel.event_type == event_type)

    total = query.count()
    records = query.order_by(CanonicalEventModel.occurred_at.desc()).offset(offset).limit(limit).all()

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "events": [
            {
                "event_id": r.id,
                "provider": r.provider,
                "event_type": r.event_type,
                "occurred_at": r.occurred_at.isoformat(),
                "received_at": r.received_at.isoformat(),
                "correlation_id": r.correlation_id,
                "causation_id": r.causation_id,
                "idempotency_key": r.idempotency_key,
                "actor": r.actor,
                "source": r.source,
                "payload_preview": str(r.payload)[:200],
            }
            for r in records
        ],
    }


@router.get("/events/{event_id}", summary="Get unified lifecycle overview for a canonical event")
def get_event_lifecycle(
    event_id: str,
    current_user: User = Depends(require_role(UserRole.MANAGER.value)),
    db: Session = Depends(get_db),
):
    event = db.query(CanonicalEventModel).filter(
        CanonicalEventModel.id == event_id,
        CanonicalEventModel.organization_id == current_user.organization_id,
    ).first()

    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Canonical event '{event_id}' not found.",
        )

    outbox_entries = db.query(EventOutbox).filter(
        EventOutbox.event_id == event_id,
        EventOutbox.organization_id == current_user.organization_id,
    ).all()

    processing_states = db.query(EventProcessingState).filter(
        EventProcessingState.event_id == event_id,
        EventProcessingState.organization_id == current_user.organization_id,
    ).all()

    dead_letters = db.query(EventDeadLetter).filter(
        EventDeadLetter.event_id == event_id,
        EventDeadLetter.organization_id == current_user.organization_id,
    ).all()

    return {
        "event_id": event.id,
        "organization_id": event.organization_id,
        "provider": event.provider,
        "event_type": event.event_type,
        "correlation_id": event.correlation_id,
        "causation_id": event.causation_id,
        "idempotency_key": event.idempotency_key,
        "occurred_at": event.occurred_at.isoformat(),
        "received_at": event.received_at.isoformat(),
        "actor": event.actor,
        "source": event.source,
        "payload": event.payload,
        "outbox": [
            {
                "outbox_id": o.id,
                "run_id": o.run_id,
                "status": o.status,
                "attempts": o.attempts,
                "claimed_at": o.claimed_at.isoformat() if o.claimed_at else None,
                "published_at": o.published_at.isoformat() if o.published_at else None,
                "last_error": o.last_error,
            }
            for o in outbox_entries
        ],
        "consumer_groups": [
            {
                "state_id": s.id,
                "consumer_group": s.consumer_group,
                "run_id": s.run_id,
                "run_type": s.run_type,
                "status": s.status,
                "attempt_count": s.attempt_count,
                "worker_id": s.worker_id,
                "last_error": s.last_error,
                "processed_at": s.processed_at.isoformat() if s.processed_at else None,
                "next_retry_at": s.next_retry_at.isoformat() if s.next_retry_at else None,
            }
            for s in processing_states
        ],
        "dead_letters": [
            {
                "dlq_id": d.id,
                "consumer_group": d.consumer_group,
                "run_id": d.run_id,
                "failure_reason": d.failure_reason,
                "error_details": d.error_details,
                "attempts": d.attempts,
                "failed_at": d.failed_at.isoformat(),
                "resolved_at": d.resolved_at.isoformat() if d.resolved_at else None,
                "resolution_status": d.resolution_status,
            }
            for d in dead_letters
        ],
    }


@router.get("/workers", summary="Worker pool health and stream lag metrics")
def get_worker_metrics(
    current_user: User = Depends(require_role(UserRole.ADMIN.value)),
):
    group_stats = {}
    for grp in DEFAULT_CONSUMER_GROUPS:
        pending = event_bus.get_pending_count(grp)
        group_stats[grp] = {
            "status": "healthy",
            "pending_messages": pending,
        }

    return {
        "status": "online",
        "stream": "company_brain:events",
        "consumer_groups": group_stats,
    }


@router.get("/dead-letters", summary="List dead-lettered events for organization")
def list_dead_letters(
    consumer_group: Optional[str] = None,
    resolution_status: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    current_user: User = Depends(require_role(UserRole.ADMIN.value)),
    db: Session = Depends(get_db),
):
    records = DeadLetterService.list_dead_letters(
        db=db,
        organization_id=current_user.organization_id,
        consumer_group=consumer_group,
        resolution_status=resolution_status,
        limit=limit,
    )

    return [
        {
            "id": r.id,
            "event_id": r.event_id,
            "consumer_group": r.consumer_group,
            "run_id": r.run_id,
            "failure_reason": r.failure_reason,
            "error_details": r.error_details,
            "attempts": r.attempts,
            "failed_at": r.failed_at.isoformat(),
            "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
            "resolution_status": r.resolution_status,
        }
        for r in records
    ]


@router.post("/dead-letters/{dlq_id}/retry", summary="Re-queue a dead-lettered event")
def retry_dead_letter(
    dlq_id: str,
    current_user: User = Depends(require_role(UserRole.ADMIN.value)),
    db: Session = Depends(get_db),
):
    resolved = DeadLetterService.retry_dead_letter(
        db=db,
        dlq_id=dlq_id,
        organization_id=current_user.organization_id,
    )
    if not resolved:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dead letter record '{dlq_id}' not found.",
        )
    return {
        "status": "retried",
        "dlq_id": dlq_id,
        "event_id": resolved.event_id,
        "message": "Dead-lettered event re-enqueued for outbox publishing.",
    }


@router.post("/events/replay", summary="Trigger auditable replay of historical events")
def trigger_replay(
    request: ReplayRequest,
    current_user: User = Depends(require_role(UserRole.ADMIN.value)),
    db: Session = Depends(get_db),
):
    result = EventReplayService.trigger_replay(
        db=db,
        organization_id=current_user.organization_id,
        requested_by=current_user.email,
        reason=request.reason,
        provider=request.provider,
        event_type=request.event_type,
        start_date=request.start_date,
        end_date=request.end_date,
        limit=request.limit,
    )
    return result
