from datetime import datetime
from typing import List, Optional, Union
from pydantic import BaseModel, ConfigDict


class WorkflowActionResponse(BaseModel):
    id: str
    conflict_id: str
    layer: str = "Layer 0 — Execution"
    tool: str
    title: str
    description: str
    status: str = "completed"
    created_at: Union[datetime, str]
    model_config = ConfigDict(from_attributes=True)


class WorkflowsListResponse(BaseModel):
    workflows: List[WorkflowActionResponse]


class AuditLogResponse(BaseModel):
    id: str
    conflict_id: Optional[str] = None
    actor: str = "System"
    action: str
    title: str
    reason: str = ""
    timestamp: Union[datetime, str]
    evidence_count: int = 0
    detected_by: str = ""
    risk_level: str = "LOW"
    layer: str = "Security & Audit"
    model_config = ConfigDict(from_attributes=True)


class AuditLogsListResponse(BaseModel):
    audit_logs: List[AuditLogResponse]
