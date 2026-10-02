from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.layer3_pipeline.event_bus import EventBusService
from app.schemas.pipeline import PipelineStatusResponse

router = APIRouter()


@router.get("/status", response_model=PipelineStatusResponse, summary="Layer 3 Event Bus, Celery workers, and LangGraph orchestrator status")
def get_pipeline_status(db: Session = Depends(get_db)):
    return EventBusService.get_stats(db)
