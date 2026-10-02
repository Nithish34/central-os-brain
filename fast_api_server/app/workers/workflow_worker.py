import logging
from typing import Optional
from sqlalchemy.orm import Session

from app.events.schemas import CanonicalEvent
from app.workers.base import BaseWorker

logger = logging.getLogger(__name__)


class WorkflowWorker(BaseWorker):
    """
    Workflow Worker for the 'workflow-workers' consumer group.
    Evaluates policy triggers and automated workflow actions for incoming canonical events.
    """

    def __init__(self, worker_id: Optional[str] = None):
        super().__init__(consumer_group="workflow-workers", worker_id=worker_id)

    def process_event(self, event: CanonicalEvent, run_id: str, db: Session) -> None:
        """
        Evaluates workflow rules for canonical event.
        """
        payload = event.payload or {}
        event_type = event.event_type

        # Example rule check: detect security/architecture decisions
        is_critical = "security" in str(payload).lower() or "architecture" in event_type.lower()
        if is_critical:
            logger.info(
                f"[WorkflowWorker] Critical workflow trigger detected for event {event.event_id} (provider={event.provider}, run={run_id})"
            )
        else:
            logger.debug(
                f"[WorkflowWorker] Processed event {event.event_id} - no active trigger conditions matched."
            )
