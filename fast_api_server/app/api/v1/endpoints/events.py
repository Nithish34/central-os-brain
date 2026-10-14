import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.caching import cache_manager, build_cache_key
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.services.layer1_data.db_service import DataService
from app.schemas.event import EventsListResponse, EventResponse

router = APIRouter()


@router.get("", response_model=EventsListResponse, summary="List all communication events for organization")
def get_events(
    request: Request,
    source: Optional[str] = Query(None, description="Filter by event source"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cache_key = build_cache_key(current_user.organization_id, "events", extra=source or "all")
    t0 = time.perf_counter()
    cached = cache_manager.get(cache_key)
    if cached is not None:
        _record_timing(request, "cache", t0)
        return cached

    t_db = time.perf_counter()
    events = DataService.get_events(db, organization_id=current_user.organization_id)
    if source:
        events = [e for e in events if e.source.lower() == source.lower()]
    result = {"events": events}
    _record_timing(request, "db", t_db)

    cache_manager.set(cache_key, result, ttl=60)
    return result


@router.get("/{event_id}", response_model=EventResponse, summary="Get single event by ID within organization")
def get_event(
    event_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cache_key = build_cache_key(current_user.organization_id, "events", extra=event_id)
    t0 = time.perf_counter()
    cached = cache_manager.get(cache_key)
    if cached is not None:
        _record_timing(request, "cache", t0)
        return cached

    t_db = time.perf_counter()
    event = DataService.get_event_by_id(db, event_id, organization_id=current_user.organization_id)
    _record_timing(request, "db", t_db)

    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    cache_manager.set(cache_key, event, ttl=120)
    return event


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _record_timing(request: Request, label: str, t_start: float) -> None:
    """Append a Server-Timing metric to the request state for ServerTimingMiddleware."""
    if not hasattr(request.state, "server_timing"):
        request.state.server_timing = {}
    request.state.server_timing[label] = (time.perf_counter() - t_start) * 1000
