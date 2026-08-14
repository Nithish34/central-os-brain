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
    def get_agent_summaries(db: Session) -> List[Dict[str, Any]]:
        agents = db.query(AgentProfile).all()
        conflicts = db.query(Conflict).all()
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
