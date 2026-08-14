from typing import Tuple, Dict, Any, List
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.conflict import Conflict
from app.models.document import Document
from app.models.workflow import WorkflowAction
from app.models.audit import AuditLog
from app.services.layer2_intelligence.conflict_detector import ConflictDetectorService


class ActionExecutorService:
    """
    Layer 0: Action Executor.
    Orchestrates live/simulated workflows across Knowledge Base, Jira, Slack, GitHub, and Audit Log.
    """

    @staticmethod
    def create_workflows(db: Session, conflict: Conflict) -> List[WorkflowAction]:
        created_at = datetime.now().astimezone().isoformat(timespec="seconds")

        actions_data = [
            {
                "id": f"wf-{conflict.id}-riskcheck",
                "conflict_id": conflict.id,
                "layer": "Layer 0 — Execution",
                "tool": "Risk & Policy Engine",
                "title": "Risk & policy check passed",
                "description": f"Approval matrix validated for {conflict.owner}. Risk level: {conflict.risk_level}. All rules passed.",
                "status": "completed",
                "created_at": created_at,
            },
            {
                "id": f"wf-{conflict.id}-doc",
                "conflict_id": conflict.id,
                "layer": "Layer 0 — Execution",
                "tool": "Knowledge Base",
                "title": "Official document updated",
                "description": conflict.recommended_update,
                "status": "completed",
                "created_at": created_at,
            },
            {
                "id": f"wf-{conflict.id}-jira",
                "conflict_id": conflict.id,
                "layer": "Layer 0 — Execution",
                "tool": "Jira",
                "title": f"Task created for {conflict.owner}",
                "description": f"Review and operationalize: {conflict.title}",
                "status": "completed",
                "created_at": created_at,
            },
            {
                "id": f"wf-{conflict.id}-slack",
                "conflict_id": conflict.id,
                "layer": "Layer 0 — Execution",
                "tool": "Slack",
                "title": "Owner notified via Slack",
                "description": f"{conflict.owner} was notified with evidence and recommended next steps.",
                "status": "completed",
                "created_at": created_at,
            },
            {
                "id": f"wf-{conflict.id}-github",
                "conflict_id": conflict.id,
                "layer": "Layer 0 — Execution",
                "tool": "GitHub",
                "title": "Documentation PR drafted",
                "description": "A simulated documentation pull request was generated for audit-friendly review.",
                "status": "completed",
                "created_at": created_at,
            },
        ]

        created_objs = []
        for data in actions_data:
            existing = db.query(WorkflowAction).filter(WorkflowAction.id == data["id"]).first()
            if not existing:
                action_obj = WorkflowAction(**data)
                db.add(action_obj)
                created_objs.append(action_obj)
            else:
                created_objs.append(existing)

        db.commit()
        return created_objs

    @staticmethod
    def log_audit(db: Session, conflict: Conflict, action: str, reason: str = "") -> AuditLog:
        audit_count = db.query(AuditLog).count()
        entry = AuditLog(
            id=f"audit-{audit_count + 1}",
            conflict_id=conflict.id,
            actor="Hackathon Demo Admin",
            action=action,
            title=conflict.title,
            reason=reason,
            timestamp=datetime.now().astimezone().isoformat(timespec="seconds"),
            evidence_count=len(conflict.evidence_ids),
            detected_by=conflict.detected_by,
            risk_level=conflict.risk_level,
            layer="Layer 0 — Execution"
        )
        db.add(entry)
        db.commit()
        db.refresh(entry)
        return entry

    @staticmethod
    def apply_approval(db: Session, conflict_id: str, action: str, reason: str = "") -> Tuple[int, Dict[str, Any]]:
        conflict = db.query(Conflict).filter(Conflict.id == conflict_id).first()
        if not conflict:
            return 404, {"error": "Conflict not found"}

        if action == "approve":
            conflict.status = "approved"
            document = db.query(Document).filter(Document.id == conflict.document_id).first()
            if document:
                document.content = conflict.recommended_update
                document.freshness_score = 0.97
                document.status = "healthy"

            db.commit()
            workflows = ActionExecutorService.create_workflows(db, conflict)
            audit = ActionExecutorService.log_audit(db, conflict, "approved", reason)
            enriched = ConflictDetectorService.enrich_conflict(db, conflict)

            wf_dicts = [
                {
                    "id": w.id,
                    "conflict_id": w.conflict_id,
                    "layer": w.layer,
                    "tool": w.tool,
                    "title": w.title,
                    "description": w.description,
                    "status": w.status,
                    "created_at": w.created_at,
                }
                for w in workflows
            ]

            audit_dict = {
                "id": audit.id,
                "conflict_id": audit.conflict_id,
                "actor": audit.actor,
                "action": audit.action,
                "title": audit.title,
                "reason": audit.reason,
                "timestamp": audit.timestamp,
                "evidence_count": audit.evidence_count,
                "detected_by": audit.detected_by,
                "risk_level": audit.risk_level,
                "layer": audit.layer,
            }

            return 200, {
                "conflict": enriched,
                "workflows": wf_dicts,
                "audit": audit_dict,
            }

        if action == "reject":
            conflict.status = "rejected"
            db.commit()
            audit = ActionExecutorService.log_audit(db, conflict, "rejected", reason)
            enriched = ConflictDetectorService.enrich_conflict(db, conflict)

            audit_dict = {
                "id": audit.id,
                "conflict_id": audit.conflict_id,
                "actor": audit.actor,
                "action": audit.action,
                "title": audit.title,
                "reason": audit.reason,
                "timestamp": audit.timestamp,
                "evidence_count": audit.evidence_count,
                "detected_by": audit.detected_by,
                "risk_level": audit.risk_level,
                "layer": audit.layer,
            }

            return 200, {
                "conflict": enriched,
                "workflows": [],
                "audit": audit_dict,
            }

        return 400, {"error": "Unsupported action"}
