import json
from sqlalchemy import Column, String, Float, Boolean, Text
from app.core.database import Base


class CompanyEvent(Base):
    __tablename__ = "events"

    id = Column(String, primary_key=True, index=True)
    source = Column(String, nullable=False, index=True)  # Slack, GitHub, Jira, etc.
    type = Column(String, nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    author = Column(String, nullable=False)
    owner = Column(String, nullable=False, index=True)
    timestamp = Column(String, nullable=False)
    authority_score = Column(Float, default=0.85)
    freshness_score = Column(Float, default=0.95)
    _tags = Column("tags", Text, default="[]")

    # Layer 3 & Layer 4 Pipeline metadata
    pipeline_stage = Column(String, default="processed")  # queued, routed, processed
    event_type_normalized = Column(String, default="operational_decision")
    ingestion_source = Column(String, default="connector")
    vector_indexed = Column(Boolean, default=True)

    @property
    def tags(self) -> list[str]:
        try:
            return json.loads(self._tags)
        except Exception:
            return []

    @tags.setter
    def tags(self, value: list[str]) -> None:
        self._tags = json.dumps(value)
