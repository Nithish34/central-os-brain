from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.auth.dependencies import get_current_user
from app.services.layer2_intelligence.multi_agent import MultiAgentService
from app.schemas.agent import AgentsListResponse

router = APIRouter()


@router.get("", response_model=AgentsListResponse, summary="List all domain agents and their detection statistics for organization")
def get_agents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    agents = MultiAgentService.get_agent_summaries(db, organization_id=current_user.organization_id)
    return {"agents": agents}
