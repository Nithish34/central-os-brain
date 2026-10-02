from typing import List, Optional
from sqlalchemy.orm import Session
from app.models.document import Document, DocumentChunk
from app.models.event import CompanyEvent
from app.models.conflict import Conflict
from app.models.agent import AgentProfile
from app.models.audit import AuditLog
from app.models.workflow import WorkflowAction


class DataService:
    @staticmethod
    def get_documents(db: Session, organization_id: Optional[str] = None) -> List[Document]:
        q = db.query(Document)
        if organization_id:
            q = q.filter(Document.organization_id == organization_id)
        return q.all()

    @staticmethod
    def get_document_by_id(db: Session, doc_id: str, organization_id: Optional[str] = None) -> Optional[Document]:
        q = db.query(Document).filter(Document.id == doc_id)
        if organization_id:
            q = q.filter(Document.organization_id == organization_id)
        return q.first()

    @staticmethod
    def get_events(db: Session, organization_id: Optional[str] = None) -> List[CompanyEvent]:
        q = db.query(CompanyEvent)
        if organization_id:
            q = q.filter(CompanyEvent.organization_id == organization_id)
        return q.order_by(CompanyEvent.timestamp.desc()).all()

    @staticmethod
    def get_event_by_id(db: Session, event_id: str, organization_id: Optional[str] = None) -> Optional[CompanyEvent]:
        q = db.query(CompanyEvent).filter(CompanyEvent.id == event_id)
        if organization_id:
            q = q.filter(CompanyEvent.organization_id == organization_id)
        return q.first()

    @staticmethod
    def get_conflicts(db: Session, status: Optional[str] = None, organization_id: Optional[str] = None) -> List[Conflict]:
        q = db.query(Conflict)
        if organization_id:
            q = q.filter(Conflict.organization_id == organization_id)
        if status:
            q = q.filter(Conflict.status == status)
        return q.all()

    @staticmethod
    def get_conflict_by_id(db: Session, conflict_id: str, organization_id: Optional[str] = None) -> Optional[Conflict]:
        q = db.query(Conflict).filter(Conflict.id == conflict_id)
        if organization_id:
            q = q.filter(Conflict.organization_id == organization_id)
        return q.first()

    @staticmethod
    def get_agents(db: Session, organization_id: Optional[str] = None) -> List[AgentProfile]:
        q = db.query(AgentProfile)
        if organization_id:
            q = q.filter(AgentProfile.organization_id == organization_id)
        return q.all()

    @staticmethod
    def get_agent_by_id(db: Session, agent_id: str, organization_id: Optional[str] = None) -> Optional[AgentProfile]:
        q = db.query(AgentProfile).filter(AgentProfile.id == agent_id)
        if organization_id:
            q = q.filter(AgentProfile.organization_id == organization_id)
        return q.first()

    @staticmethod
    def get_workflows(db: Session, organization_id: Optional[str] = None) -> List[WorkflowAction]:
        q = db.query(WorkflowAction)
        if organization_id:
            q = q.filter(WorkflowAction.organization_id == organization_id)
        return q.order_by(WorkflowAction.created_at.desc()).all()

    @staticmethod
    def get_audit_logs(db: Session, organization_id: Optional[str] = None) -> List[AuditLog]:
        q = db.query(AuditLog)
        if organization_id:
            q = q.filter(AuditLog.organization_id == organization_id)
        return q.order_by(AuditLog.timestamp.desc()).all()
