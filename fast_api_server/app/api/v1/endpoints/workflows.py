from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.services.layer1_data.db_service import DataService
from app.schemas.workflow import WorkflowsListResponse

router = APIRouter()


@router.get("", response_model=WorkflowsListResponse, summary="List all executed Layer 0 workflow actions for organization")
def get_workflows(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    actions = DataService.get_workflows(db, organization_id=current_user.organization_id)
    return {"workflows": actions}
