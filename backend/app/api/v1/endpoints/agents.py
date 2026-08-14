from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.layer2_intelligence.multi_agent import MultiAgentService
from app.schemas.agent import AgentsListResponse

router = APIRouter()


@router.get("", response_model=AgentsListResponse, summary="List all domain agents and their detection statistics")
def get_agents(db: Session = Depends(get_db)):
    agents = MultiAgentService.get_agent_summaries(db)
    return {"agents": agents}
