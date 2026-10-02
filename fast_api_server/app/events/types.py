from enum import Enum


class EventType(str, Enum):
    # Communication / Messaging
    MESSAGE_CREATED = "message.created"
    MESSAGE_UPDATED = "message.updated"
    MESSAGE_DELETED = "message.deleted"

    # Documentation / Knowledge Base
    DOCUMENT_CREATED = "document.created"
    DOCUMENT_UPDATED = "document.updated"
    DOCUMENT_DELETED = "document.deleted"

    # Code / Repository Management
    REPOSITORY_COMMIT_CREATED = "repository.commit.created"
    REPOSITORY_PULL_REQUEST_CREATED = "repository.pull_request.created"
    REPOSITORY_PULL_REQUEST_UPDATED = "repository.pull_request.updated"
    REPOSITORY_PULL_REQUEST_MERGED = "repository.pull_request.merged"
    REPOSITORY_ISSUE_CREATED = "repository.issue.created"
    REPOSITORY_ISSUE_UPDATED = "repository.issue.updated"
    REPOSITORY_ISSUE_CLOSED = "repository.issue.closed"

    # Identity & Access
    USER_CREATED = "user.created"
    USER_UPDATED = "user.updated"

    # Integrations Lifecycle
    INTEGRATION_CONNECTED = "integration.connected"
    INTEGRATION_DISCONNECTED = "integration.disconnected"


class ProcessingStatus(str, Enum):
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    DEAD_LETTER = "DEAD_LETTER"


class RunType(str, Enum):
    LIVE = "LIVE"
    REPLAY = "REPLAY"


class OutboxStatus(str, Enum):
    PENDING = "PENDING"
    CLAIMED = "CLAIMED"
    PUBLISHED = "PUBLISHED"
    FAILED = "FAILED"


class DeadLetterResolution(str, Enum):
    UNRESOLVED = "UNRESOLVED"
    RETRIED = "RETRIED"
    DISCARDED = "DISCARDED"
