from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.services.layer1_data.db_service import DataService
from app.schemas.workflow import AuditLogsListResponse

router = APIRouter()


@router.get("", response_model=AuditLogsListResponse, summary="List all immutable audit log entries for organization")
def get_audit_logs(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    logs = DataService.get_audit_logs(db, organization_id=current_user.organization_id)
    return {"audit_logs": logs}
