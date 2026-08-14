import json
from sqlalchemy import Column, String, Integer, Text
from app.core.database import Base


class AgentProfile(Base):
    __tablename__ = "agents"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    icon = Column(String, default="🤖")
    domain = Column(String, nullable=False)
    status = Column(String, default="active")  # active, monitoring, idle
    conflicts_detected = Column(Integer, default=0)
    last_detection = Column(String, nullable=True)
    memory_entries = Column(Integer, default=10)
    tasks_completed = Column(Integer, default=0)
    description = Column(Text, nullable=False)
    _detected_conflict_ids = Column("detected_conflict_ids", Text, default="[]")

    @property
    def detected_conflict_ids(self) -> list[str]:
        try:
            return json.loads(self._detected_conflict_ids)
        except Exception:
            return []

    @detected_conflict_ids.setter
    def detected_conflict_ids(self, value: list[str]) -> None:
        self._detected_conflict_ids = json.dumps(value)
