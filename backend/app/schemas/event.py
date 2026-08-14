from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class EventBase(BaseModel):
    id: str
    source: str
    type: str
    title: str
    content: str
    author: str
    owner: str
    timestamp: str
    authority_score: float = 0.85
    freshness_score: float = 0.95
    tags: List[str] = []
    pipeline_stage: str = "processed"
    event_type_normalized: str = "operational_decision"
    ingestion_source: str = "connector"
    vector_indexed: bool = True


class EventCreate(EventBase):
    pass


class EventResponse(EventBase):
    model_config = ConfigDict(from_attributes=True)


class EventsListResponse(BaseModel):
    events: List[EventResponse]
