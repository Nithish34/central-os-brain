from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.layer1_data.db_service import DataService
from app.schemas.event import EventsListResponse, EventResponse

router = APIRouter()


@router.get("", response_model=EventsListResponse, summary="List all ingested company operational events")
def get_events(db: Session = Depends(get_db)):
    events = DataService.get_events(db)
    return {"events": events}


@router.get("/{event_id}", response_model=EventResponse, summary="Get single event by ID")
def get_event(event_id: str, db: Session = Depends(get_db)):
    event = DataService.get_event_by_id(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event
