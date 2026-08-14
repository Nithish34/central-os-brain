from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class WorkflowActionResponse(BaseModel):
    id: str
    conflict_id: str
    layer: str = "Layer 0 — Execution"
    tool: str
    title: str
    description: str
    status: str = "completed"
    created_at: str
    model_config = ConfigDict(from_attributes=True)


class WorkflowsListResponse(BaseModel):
    workflows: List[WorkflowActionResponse]


class AuditLogResponse(BaseModel):
    id: str
    conflict_id: str
    actor: str
    action: str
    title: str
    reason: str = ""
    timestamp: str
    evidence_count: int = 1
    detected_by: str = ""
    risk_level: str = ""
    layer: str = "Layer 0 — Execution"
    model_config = ConfigDict(from_attributes=True)


class AuditLogsListResponse(BaseModel):
    audit_logs: List[AuditLogResponse]
