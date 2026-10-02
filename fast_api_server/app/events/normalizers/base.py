from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from app.events.schemas import CanonicalEvent


class BaseEventNormalizer(ABC):
    provider: str

    @abstractmethod
    def normalize(
        self,
        payload: Dict[str, Any],
        organization_id: str,
        headers: Optional[Dict[str, str]] = None,
        correlation_id: Optional[str] = None,
    ) -> CanonicalEvent:
        """Transforms provider-specific webhook/sync payload into CanonicalEvent."""
        pass
