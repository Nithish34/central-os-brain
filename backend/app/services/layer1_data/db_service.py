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
    def get_documents(db: Session) -> List[Document]:
        return db.query(Document).all()

    @staticmethod
    def get_document_by_id(db: Session, doc_id: str) -> Optional[Document]:
        return db.query(Document).filter(Document.id == doc_id).first()

    @staticmethod
    def get_events(db: Session) -> List[CompanyEvent]:
        return db.query(CompanyEvent).order_by(CompanyEvent.timestamp.desc()).all()

    @staticmethod
    def get_event_by_id(db: Session, event_id: str) -> Optional[CompanyEvent]:
        return db.query(CompanyEvent).filter(CompanyEvent.id == event_id).first()

    @staticmethod
    def get_conflicts(db: Session, status: Optional[str] = None) -> List[Conflict]:
        query = db.query(Conflict)
        if status:
            query = query.filter(Conflict.status == status)
        return query.all()

    @staticmethod
    def get_conflict_by_id(db: Session, conflict_id: str) -> Optional[Conflict]:
        return db.query(Conflict).filter(Conflict.id == conflict_id).first()

    @staticmethod
    def get_agents(db: Session) -> List[AgentProfile]:
        return db.query(AgentProfile).all()

    @staticmethod
    def get_agent_by_id(db: Session, agent_id: str) -> Optional[AgentProfile]:
        return db.query(AgentProfile).filter(AgentProfile.id == agent_id).first()

    @staticmethod
    def get_workflows(db: Session) -> List[WorkflowAction]:
        return db.query(WorkflowAction).order_by(WorkflowAction.created_at.desc()).all()

    @staticmethod
    def get_audit_logs(db: Session) -> List[AuditLog]:
        return db.query(AuditLog).order_by(AuditLog.id.desc()).all()
