from typing import List, Dict, Any
from pydantic import BaseModel


class EventBusStats(BaseModel):
    backend: str = "Redis Streams"
    status: str = "active"
    messages_processed: int
    queue_depth: int = 0
    throughput_per_min: int = 14


class BackgroundWorkersStats(BaseModel):
    backend: str = "Celery"
    status: str = "active"
    workers_online: int = 3
    tasks_completed: int
    tasks_pending: int = 0
    queues: List[str] = ["ingestion", "embedding", "conflict-detection"]


class EventRouterStats(BaseModel):
    status: str = "active"
    events_routed: int
    pipelines_active: int = 2
    routing_rules: int = 6


class PipelineOrchestratorStats(BaseModel):
    backend: str = "LangGraph"
    status: str = "active"
    runs_total: int
    steps_per_run: int = 5
    last_run: str


class EventStageItem(BaseModel):
    id: str
    title: str
    source: str
    stage: str
    type: str
    ts: str
    author: str = "System"
    content: str = ""
    owner: str = ""


class PipelineStatusResponse(BaseModel):
    event_bus: EventBusStats
    background_workers: BackgroundWorkersStats
    event_router: EventRouterStats
    pipeline_orchestrator: PipelineOrchestratorStats
    event_stages: List[EventStageItem]


class RiskRuleItem(BaseModel):
    rule: str
    passed: bool


class RiskCheckResponse(BaseModel):
    conflict_id: str
    risk_level: str
    approved_to_proceed: bool
    rules: List[RiskRuleItem]
    required_approver: str
    escalation_path: str
    requires_legal: bool
    checked_at: str
