import logging
from typing import Dict, Optional
from app.events.normalizers.base import BaseEventNormalizer
from app.events.normalizers.slack import SlackEventNormalizer
from app.events.normalizers.github import GitHubEventNormalizer

logger = logging.getLogger(__name__)


class NormalizerRegistry:
    _normalizers: Dict[str, BaseEventNormalizer] = {}

    @classmethod
    def register(cls, normalizer: BaseEventNormalizer) -> None:
        cls._normalizers[normalizer.provider.lower()] = normalizer

    @classmethod
    def get(cls, provider: str) -> Optional[BaseEventNormalizer]:
        return cls._normalizers.get(provider.lower())


# Auto-register default normalizers
slack_normalizer = SlackEventNormalizer()
github_normalizer = GitHubEventNormalizer()

NormalizerRegistry.register(slack_normalizer)
NormalizerRegistry.register(github_normalizer)
