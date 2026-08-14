from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.layer1_data.db_service import DataService
from app.schemas.workflow import WorkflowsListResponse

router = APIRouter()


@router.get("", response_model=WorkflowsListResponse, summary="List all executed Layer 0 workflow actions")
def get_workflows(db: Session = Depends(get_db)):
    actions = DataService.get_workflows(db)
    return {"workflows": actions}
