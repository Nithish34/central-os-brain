from typing import List, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict
from app.schemas.document import DocumentResponse
from app.schemas.event import EventResponse


class AgentSummary(BaseModel):
    id: str
    name: str
    icon: str = "🤖"
    domain: str


class ConflictBase(BaseModel):
    id: str
    title: str
    severity: str = "medium"
    domain: str
    document_id: str
    evidence_ids: List[str] = []
    old_claim: str
    new_claim: str
    recommended_update: str
    business_impact: str
    owner: str
    status: str = "open"
    detected_by: str = "agent-engineering"
    contradiction_score: float = 0.85
    freshness_delta: float = 0.4
    authority_delta: float = 0.05
    graph_hops: int = 1
    risk_level: str = "MEDIUM"
    approval_matrix: Dict[str, Any] = {}


class ConflictEnriched(ConflictBase):
    document: Optional[DocumentResponse] = None
    evidence: List[EventResponse] = []
    confidence: int = 85
    detected_by_agent: Optional[AgentSummary] = None
    reasoning: str = ""
    model_config = ConfigDict(from_attributes=True)


class ConflictApprovalRequest(BaseModel):
    reason: str = "Approved by system administrator"


class ConflictRejectionRequest(BaseModel):
    reason: str = "Rejected by system administrator"


class ConflictsListResponse(BaseModel):
    conflicts: List[ConflictEnriched]


class SingleConflictResponse(BaseModel):
    conflict: ConflictEnriched
