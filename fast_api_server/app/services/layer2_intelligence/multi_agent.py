from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.agent import AgentProfile
from app.models.conflict import Conflict


class MultiAgentService:
    """
    Layer 2: Multi-Agent System (Engineering, Finance, Sales, Research agents).
    Manages agent states, detection counters, and specialization personas.
    """

    @staticmethod
    def get_agent_summaries(db: Session, organization_id: Optional[str] = None) -> List[Dict[str, Any]]:
        agents_q = db.query(AgentProfile)
        conflicts_q = db.query(Conflict)
        if organization_id:
            agents_q = agents_q.filter(AgentProfile.organization_id == organization_id)
            conflicts_q = conflicts_q.filter(Conflict.organization_id == organization_id)

        agents = agents_q.all()
        conflicts = conflicts_q.all()
        result = []

        for agent in agents:
            detected_ids = agent.detected_conflict_ids
            open_count = sum(1 for c in conflicts if c.id in detected_ids and c.status == "open")
            resolved_count = sum(1 for c in conflicts if c.id in detected_ids and c.status in {"approved", "resolved"})

            result.append({
                "id": agent.id,
                "name": agent.name,
                "icon": agent.icon,
                "domain": agent.domain,
                "status": agent.status,
                "conflicts_detected": agent.conflicts_detected,
                "last_detection": agent.last_detection,
                "memory_entries": agent.memory_entries,
                "tasks_completed": agent.tasks_completed,
                "description": agent.description,
                "detected_conflict_ids": agent.detected_conflict_ids,
                "open_conflicts": open_count,
                "resolved_conflicts": resolved_count,
            })
        return result
