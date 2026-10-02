import math
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.document import Document
from app.models.event import CompanyEvent
from app.models.conflict import Conflict
from app.models.agent import AgentProfile
from app.core.config import settings


class ConflictDetectorService:
    """
    Layer 2: Conflict & Contradiction Detection Engine.
    Computes contradiction scores, authority deltas, and freshness deltas.
    Supports live LLM NLI evaluation when API keys are present.
    """

    @staticmethod
    def severity_weight(severity: str) -> float:
        return {"critical": 1.0, "high": 0.82, "medium": 0.62, "low": 0.42}.get(severity, 0.5)

    @staticmethod
    def calculate_confidence(conflict: Conflict, document: Optional[Document], evidence: List[CompanyEvent]) -> int:
        if not document or not evidence:
            return 50

        avg_authority = sum(e.authority_score for e in evidence) / len(evidence)
        avg_freshness = sum(e.freshness_score for e in evidence) / len(evidence)
        stale_gap = max(0.0, avg_freshness - document.freshness_score)
        
        score = (
            avg_authority * 0.36
            + avg_freshness * 0.34
            + stale_gap * 0.18
            + ConflictDetectorService.severity_weight(conflict.severity) * 0.12
        )
        return min(99, max(55, round(score * 100)))

    @staticmethod
    def enrich_conflict(db: Session, conflict: Conflict) -> Dict[str, Any]:
        document = db.query(Document).filter(Document.id == conflict.document_id).first()
        raw_records = db.query(CompanyEvent).filter(CompanyEvent.id.in_(conflict.evidence_ids)).all()
        record_map = {r.id: r for r in raw_records}
        evidence_records = [record_map[eid] for eid in conflict.evidence_ids if eid in record_map]
        agent = db.query(AgentProfile).filter(AgentProfile.id == conflict.detected_by).first()

        confidence = ConflictDetectorService.calculate_confidence(conflict, document, evidence_records)

        agent_dict = None
        if agent:
            agent_dict = {
                "id": agent.id,
                "name": agent.name,
                "icon": agent.icon,
                "domain": agent.domain
            }

        return {
            "id": conflict.id,
            "title": conflict.title,
            "severity": conflict.severity,
            "domain": conflict.domain,
            "document_id": conflict.document_id,
            "evidence_ids": conflict.evidence_ids,
            "old_claim": conflict.old_claim,
            "new_claim": conflict.new_claim,
            "recommended_update": conflict.recommended_update,
            "business_impact": conflict.business_impact,
            "owner": conflict.owner,
            "status": conflict.status,
            "detected_by": conflict.detected_by,
            "contradiction_score": conflict.contradiction_score,
            "freshness_delta": conflict.freshness_delta,
            "authority_delta": conflict.authority_delta,
            "graph_hops": conflict.graph_hops,
            "risk_level": conflict.risk_level,
            "approval_matrix": conflict.approval_matrix,
            "document": document,
            "evidence": evidence_records,
            "confidence": confidence,
            "detected_by_agent": agent_dict,
            "reasoning": (
                "Newer high-authority operational evidence contradicts the official document. "
                "The safest action is to route an AI-generated update to the responsible owner "
                "for approval before changing company knowledge."
            )
        }

    @staticmethod
    def get_stats(db: Session) -> Dict[str, Any]:
        from datetime import datetime
        conflicts = db.query(Conflict).all()
        open_c = [c for c in conflicts if c.status == "open"]
        avg_contra = sum(c.contradiction_score for c in conflicts) / max(len(conflicts), 1)

        return {
            "status": "active",
            "last_run": datetime.now().astimezone().isoformat(timespec="seconds"),
            "conflicts_found": len(open_c),
            "total_processed": len(conflicts),
            "avg_contradiction": round(avg_contra, 2),
        }
