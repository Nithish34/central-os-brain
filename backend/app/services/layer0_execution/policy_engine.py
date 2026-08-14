from typing import Dict, Any, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.conflict import Conflict
from app.models.document import Document
from app.models.event import CompanyEvent


class PolicyEngineService:
    """
    Layer 0: Risk & Policy Engine.
    Evaluates rule matrix before human approval is accepted.
    """

    @staticmethod
    def evaluate_risk(db: Session, conflict_id: str) -> Tuple[int, Dict[str, Any]]:
        conflict = db.query(Conflict).filter(Conflict.id == conflict_id).first()
        if not conflict:
            return 404, {"error": "Conflict not found"}

        document = db.query(Document).filter(Document.id == conflict.document_id).first()
        evidence = db.query(CompanyEvent).filter(CompanyEvent.id.in_(conflict.evidence_ids)).all()

        avg_evidence_auth = sum(e.authority_score for e in evidence) / max(len(evidence), 1) if evidence else 0.5

        rules = [
            {"rule": "Minimum evidence sources", "passed": len(evidence) >= 1},
            {"rule": "Evidence authority threshold", "passed": avg_evidence_auth >= 0.80},
            {"rule": "Document is stale", "passed": document.status != "healthy" if document else False},
            {"rule": "Conflict has owner", "passed": bool(conflict.owner)},
            {"rule": "Recommended update exists", "passed": bool(conflict.recommended_update)},
        ]

        all_passed = all(r["passed"] for r in rules)
        matrix = conflict.approval_matrix

        return 200, {
            "conflict_id": conflict.id,
            "risk_level": conflict.risk_level,
            "approved_to_proceed": all_passed,
            "rules": rules,
            "required_approver": matrix.get("required_approver", conflict.owner),
            "escalation_path": matrix.get("escalation_path", "Engineering Manager"),
            "requires_legal": matrix.get("requires_legal", False),
            "checked_at": datetime.now().astimezone().isoformat(timespec="seconds"),
        }
