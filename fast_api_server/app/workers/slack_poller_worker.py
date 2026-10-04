import logging
import time
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.services.slack_service import SlackMessageReadingService

logger = logging.getLogger(__name__)


class SlackPollerWorker:
    """
    Background worker for continuous message reading across all active multi-user Slack connections.
    Polls channels, retrieves latest messages with cursor deduplication, and emits canonical events.
    """

    def __init__(self, poll_interval_seconds: int = 30):
        self.poll_interval_seconds = poll_interval_seconds

    def poll_once(self, db: Session) -> dict:
        """Execute a single polling cycle across all active Slack connections."""
        results = SlackMessageReadingService.poll_all_active_connections(db)
        total_messages = sum(r.get("result", {}).get("messages_processed", 0) for r in results)
        return {
            "connections_checked": len(results),
            "messages_processed": total_messages,
            "details": results,
        }

    def run_loop(self, is_running_callback=None):
        """Continuous polling loop."""
        logger.info(f"Starting SlackPollerWorker with {self.poll_interval_seconds}s interval...")
        while is_running_callback is None or is_running_callback():
            db = SessionLocal()
            try:
                stats = self.poll_once(db)
                if stats["messages_processed"] > 0:
                    logger.info(f"Slack poller cycle finished: {stats['messages_processed']} messages processed across {stats['connections_checked']} connections.")
            except Exception as e:
                logger.error(f"Slack poller cycle encountered error: {e}", exc_info=True)
            finally:
                db.close()
            time.sleep(self.poll_interval_seconds)


slack_poller_worker = SlackPollerWorker()
