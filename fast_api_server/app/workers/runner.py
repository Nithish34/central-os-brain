import logging
import time
from typing import Optional
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.events.outbox_publisher import OutboxPublisher, outbox_publisher
from app.events.bus import RedisEventBus, event_bus
from app.workers.knowledge_worker import KnowledgeWorker
from app.workers.workflow_worker import WorkflowWorker
from app.workers.audit_worker import AuditWorker

logger = logging.getLogger(__name__)


class WorkerRunner:
    """
    Supervisor / Coordinator for Outbox Publisher and Consumer Group Workers.
    """

    def __init__(
        self,
        bus: Optional[RedisEventBus] = None,
        publisher: Optional[OutboxPublisher] = None,
    ):
        self.bus = bus or event_bus
        self.publisher = publisher or outbox_publisher
        self.knowledge_worker = KnowledgeWorker()
        self.workflow_worker = WorkflowWorker()
        self.audit_worker = AuditWorker()

    def ensure_infrastructure(self):
        """Initializes Redis stream consumer groups."""
        self.bus.ensure_consumer_groups()

    def process_all_pending(self, db: Session, batch_size: int = 50) -> dict:
        """
        Runs one synchronous pass over:
        1. Outbox publishing (Postgres -> Redis Stream)
        2. Knowledge workers
        3. Workflow workers
        4. Audit workers
        Returns execution statistics.
        """
        self.ensure_infrastructure()

        published = self.publisher.publish_pending_batch(db, batch_size=batch_size)
        knowledge_processed = self.knowledge_worker.poll_and_process_batch(db, count=batch_size)
        workflow_processed = self.workflow_worker.poll_and_process_batch(db, count=batch_size)
        audit_processed = self.audit_worker.poll_and_process_batch(db, count=batch_size)

        return {
            "outbox_published": published,
            "knowledge_processed": knowledge_processed,
            "workflow_processed": workflow_processed,
            "audit_processed": audit_processed,
        }


worker_runner = WorkerRunner()
