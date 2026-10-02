from datetime import datetime, timezone
from typing import Dict, Any, Optional
from app.events.schemas import CanonicalEvent, ActorInfo, SourceInfo
from app.events.factory import create_canonical_event
from app.events.types import EventType
from app.events.normalizers.base import BaseEventNormalizer


class GitHubEventNormalizer(BaseEventNormalizer):
    provider: str = "github"

    def normalize(
        self,
        payload: Dict[str, Any],
        organization_id: str,
        headers: Optional[Dict[str, str]] = None,
        correlation_id: Optional[str] = None,
    ) -> CanonicalEvent:
        event_header = (headers or {}).get("x-github-event", "")
        delivery_id = (headers or {}).get("x-github-delivery") or payload.get("delivery_id")

        action = payload.get("action", "")
        sender = payload.get("sender", {})
        repo = payload.get("repository", {})

        # Determine granular event type
        if "pull_request" in payload or event_header == "pull_request":
            pr = payload.get("pull_request", {})
            if pr.get("merged") or action == "closed" and pr.get("merged"):
                event_type = EventType.REPOSITORY_PULL_REQUEST_MERGED.value
            elif action == "opened":
                event_type = EventType.REPOSITORY_PULL_REQUEST_CREATED.value
            else:
                event_type = EventType.REPOSITORY_PULL_REQUEST_UPDATED.value

            external_id = str(delivery_id or pr.get("id") or f"gh_pr_{pr.get('number')}")
            title = pr.get("title", "GitHub Pull Request")
            body = pr.get("body", "")
            resource_url = pr.get("html_url")
            event_payload = {
                "number": pr.get("number"),
                "title": title,
                "body": body,
                "merged": pr.get("merged", False),
                "state": pr.get("state"),
                "base_branch": pr.get("base", {}).get("ref"),
                "head_branch": pr.get("head", {}).get("ref"),
            }

        elif "issue" in payload or event_header == "issues":
            issue = payload.get("issue", {})
            if action == "closed":
                event_type = EventType.REPOSITORY_ISSUE_CLOSED.value
            elif action == "opened":
                event_type = EventType.REPOSITORY_ISSUE_CREATED.value
            else:
                event_type = EventType.REPOSITORY_ISSUE_UPDATED.value

            external_id = str(delivery_id or issue.get("id") or f"gh_issue_{issue.get('number')}")
            title = issue.get("title", "GitHub Issue")
            body = issue.get("body", "")
            resource_url = issue.get("html_url")
            event_payload = {
                "number": issue.get("number"),
                "title": title,
                "body": body,
                "state": issue.get("state"),
            }

        elif "commits" in payload or event_header == "push":
            event_type = EventType.REPOSITORY_COMMIT_CREATED.value
            head_commit = payload.get("head_commit") or (payload.get("commits", [{}])[-1])
            external_id = str(head_commit.get("id") or delivery_id)
            title = head_commit.get("message", "GitHub Push")
            body = "\n".join(c.get("message", "") for c in payload.get("commits", []))
            resource_url = head_commit.get("url")
            event_payload = {
                "ref": payload.get("ref"),
                "commit_id": head_commit.get("id"),
                "message": title,
                "commit_count": len(payload.get("commits", [])),
            }

        else:
            event_type = f"github.{event_header or 'activity'}"
            external_id = str(delivery_id or f"gh_evt_{datetime.now().timestamp()}")
            title = f"GitHub {event_header}"
            body = str(payload)
            resource_url = repo.get("html_url")
            event_payload = {"raw_payload": payload}

        actor = ActorInfo(
            id=str(sender.get("id", "gh-user")),
            display_name=sender.get("login", "github-bot"),
            role="contributor",
        )

        source = SourceInfo(
            provider="github",
            workspace_id=str(repo.get("owner", {}).get("login")),
            repository_id=str(repo.get("full_name") or repo.get("name")),
            resource_url=resource_url,
        )

        return create_canonical_event(
            organization_id=organization_id,
            provider="github",
            event_type=event_type,
            actor=actor,
            source=source,
            occurred_at=datetime.now(timezone.utc),
            payload=event_payload,
            external_event_id=external_id,
            external_account_id=str(repo.get("id")),
            correlation_id=correlation_id,
            metadata={"github_delivery_id": delivery_id, "repository": repo.get("full_name")},
        )


github_normalizer = GitHubEventNormalizer()
