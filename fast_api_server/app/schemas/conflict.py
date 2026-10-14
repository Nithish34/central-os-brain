from typing import List, Optional, Any, Dict
from pydantic import BaseModel, ConfigDict
from app.schemas.document import DocumentResponse
from app.schemas.event import EventResponse


class AgentSummary(BaseModel):
    id: str
    name: str
    icon: str = "🤖"
    domain: str


class ConflictEvidenceResponse(BaseModel):
    id: str
    conflict_id: str
    event_id: Optional[str] = None
    source: str
    content_excerpt: str
    author: Optional[str] = None
    authority_score: float = 0.5
    timestamp: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class ConflictBase(BaseModel):
    id: str
    title: str
    description: Optional[str] = ""
    severity: str = "medium"
    status: str = "open"
    domain: Optional[str] = "Engineering"
    document_id: Optional[str] = None
    evidence_ids: List[str] = []
    dedup_hash: Optional[str] = None
    target_repo: Optional[str] = None
    target_file_path: Optional[str] = None
    recommended_diff: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[Any] = None
    old_claim: Optional[str] = ""
    new_claim: Optional[str] = ""
    recommended_update: Optional[str] = ""
    business_impact: Optional[str] = ""
    owner: Optional[str] = "Engineering"
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
    evidences: List[ConflictEvidenceResponse] = []
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
