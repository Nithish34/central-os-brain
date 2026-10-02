from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.services.layer1_data.db_service import DataService
from app.schemas.event import EventsListResponse, EventResponse

router = APIRouter()


@router.get("", response_model=EventsListResponse, summary="List all communication events for organization")
def get_events(
    source: Optional[str] = Query(None, description="Filter by event source"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    events = DataService.get_events(db, organization_id=current_user.organization_id)
    if source:
        events = [e for e in events if e.source.lower() == source.lower()]
    return {"events": events}


@router.get("/{event_id}", response_model=EventResponse, summary="Get single event by ID within organization")
def get_event(
    event_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    event = DataService.get_event_by_id(db, event_id, organization_id=current_user.organization_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event
