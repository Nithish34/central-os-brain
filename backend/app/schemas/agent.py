from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class AgentBase(BaseModel):
    id: str
    name: str
    icon: str = "🤖"
    domain: str
    status: str = "active"
    conflicts_detected: int = 0
    last_detection: Optional[str] = None
    memory_entries: int = 10
    tasks_completed: int = 0
    description: str
    detected_conflict_ids: List[str] = []


class AgentResponse(AgentBase):
    open_conflicts: int = 0
    resolved_conflicts: int = 0
    model_config = ConfigDict(from_attributes=True)


class AgentsListResponse(BaseModel):
    agents: List[AgentResponse]
