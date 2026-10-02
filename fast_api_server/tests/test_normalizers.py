import pytest
from app.events.normalizers.registry import NormalizerRegistry
from app.events.normalizers.slack import SlackEventNormalizer
from app.events.normalizers.github import GitHubEventNormalizer
from app.events.types import EventType


def test_registry_registration():
    slack_norm = NormalizerRegistry.get("slack")
    github_norm = NormalizerRegistry.get("github")
    assert isinstance(slack_norm, SlackEventNormalizer)
    assert isinstance(github_norm, GitHubEventNormalizer)


def test_slack_normalizer_message():
    normalizer = SlackEventNormalizer()
    payload = {
        "team_id": "T04839210",
        "event_id": "Ev0893129",
        "event_time": 1726914600,
        "event": {
            "type": "message",
            "client_msg_id": "msg-guid-12345",
            "user": "U12345",
            "text": "Meeting notes: security architecture approved.",
            "channel": "C999",
            "ts": "1726914600.000200",
        },
    }
    canonical = normalizer.normalize(payload, organization_id="org-alpha")

    assert canonical.provider == "slack"
    assert canonical.event_type == EventType.MESSAGE_CREATED.value
    assert canonical.external_event_id == "msg-guid-12345"
    assert canonical.actor.external_user_id == "U12345"
    assert canonical.source.channel_id == "C999"
    assert canonical.payload["text"] == "Meeting notes: security architecture approved."


def test_github_normalizer_pull_request():
    normalizer = GitHubEventNormalizer()
    payload = {
        "action": "opened",
        "pull_request": {
            "id": 1001,
            "title": "feat: Event-Driven Platform Phase 4",
            "body": "Implements outbox publisher and redis streams.",
            "html_url": "https://github.com/acme/repo/pull/1",
            "created_at": "2026-09-21T10:00:00Z",
            "user": {"login": "octocat", "id": 583231},
        },
        "repository": {
            "id": 888,
            "full_name": "acme/brain-os",
            "html_url": "https://github.com/acme/brain-os",
        },
        "sender": {"login": "octocat", "id": 583231},
    }
    headers = {"x-github-delivery": "delivery-uuid-999", "x-github-event": "pull_request"}
    canonical = normalizer.normalize(payload, organization_id="org-alpha", headers=headers)

    assert canonical.provider == "github"
    assert canonical.event_type == EventType.REPOSITORY_PULL_REQUEST_CREATED.value
    assert canonical.external_event_id == "delivery-uuid-999"
    assert canonical.actor.name == "octocat"
    assert canonical.source.repository_id == "acme/brain-os"
    assert canonical.payload["title"] == "feat: Event-Driven Platform Phase 4"
