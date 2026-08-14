from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.layer1_data.db_service import DataService
from app.schemas.workflow import AuditLogsListResponse

router = APIRouter()


@router.get("", response_model=AuditLogsListResponse, summary="List all immutable audit log entries")
def get_audit_logs(db: Session = Depends(get_db)):
    logs = DataService.get_audit_logs(db)
    return {"audit_logs": logs}
