import logging
from typing import Dict, Type, Optional, List
from app.integrations.base import BaseConnector
from app.core.security import create_oauth_state, verify_oauth_state

logger = logging.getLogger(__name__)


class ConnectorRegistry:
    _connectors: Dict[str, BaseConnector] = {}

    @classmethod
    def register(cls, connector: BaseConnector) -> None:
        cls._connectors[connector.provider.lower()] = connector
        logger.info(f"Registered connector for provider: {connector.provider}")

    @classmethod
    def get(cls, provider: str) -> Optional[BaseConnector]:
        return cls._connectors.get(provider.lower())

    @classmethod
    def list_providers(cls) -> List[str]:
        return list(cls._connectors.keys())


class OAuthManager:
    @staticmethod
    def generate_state(organization_id: str, provider: str) -> str:
        return create_oauth_state(organization_id, provider.lower(), ttl_seconds=600)

    @staticmethod
    def validate_state(state: str, provider: str) -> Optional[str]:
        return verify_oauth_state(state, provider.lower())
