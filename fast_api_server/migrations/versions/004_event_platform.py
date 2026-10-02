"""Event platform: canonical_events, event_outbox, event_processing, event_dead_letters

Revision ID: 004_event_platform
Revises: 003_integrations
Create Date: 2026-09-21 21:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "004_event_platform"
down_revision: Union[str, None] = "003_integrations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Canonical Events Table
    op.create_table(
        "canonical_events",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("organization_id", sa.String(length=64), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("event_type", sa.String(length=128), nullable=False),
        sa.Column("external_event_id", sa.String(length=255), nullable=True),
        sa.Column("external_account_id", sa.String(length=255), nullable=True),
        sa.Column("idempotency_key", sa.String(length=64), nullable=False),
        sa.Column("actor", sa.Text(), server_default="{}", nullable=False),
        sa.Column("source", sa.Text(), server_default="{}", nullable=False),
        sa.Column("payload", sa.Text(), server_default="{}", nullable=False),
        sa.Column("metadata", sa.Text(), server_default="{}", nullable=False),
        sa.Column("correlation_id", sa.String(length=64), nullable=False),
        sa.Column("causation_id", sa.String(length=64), nullable=True),
        sa.Column("schema_version", sa.String(length=16), server_default="1.0.0", nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_canonical_events_id", "canonical_events", ["id"])
    op.create_index("ix_canonical_events_organization_id", "canonical_events", ["organization_id"])
    op.create_index("ix_canonical_events_provider", "canonical_events", ["provider"])
    op.create_index("ix_canonical_events_event_type", "canonical_events", ["event_type"])
    op.create_index("ix_canonical_events_idempotency_key", "canonical_events", ["idempotency_key"])
    op.create_index("ix_canonical_events_correlation_id", "canonical_events", ["correlation_id"])
    op.create_index("ix_canonical_events_causation_id", "canonical_events", ["causation_id"])
    op.create_index("ix_canonical_events_occurred_at", "canonical_events", ["occurred_at"])
    op.create_index("ix_canonical_org_provider", "canonical_events", ["organization_id", "provider"])
    op.create_index("ix_canonical_org_occurred", "canonical_events", ["organization_id", "occurred_at"])
    op.create_unique_constraint("uq_canonical_org_idempotency", "canonical_events", ["organization_id", "idempotency_key"])

    # 2. Event Outbox Table
    op.create_table(
        "event_outbox",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("organization_id", sa.String(length=64), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("event_id", sa.String(length=64), sa.ForeignKey("canonical_events.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("run_id", sa.String(length=64), server_default="run_live_001", nullable=False),
        sa.Column("topic", sa.String(length=128), server_default="company_brain:events", nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="PENDING", nullable=False),
        sa.Column("claimed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("claimed_by", sa.String(length=128), nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_event_outbox_id", "event_outbox", ["id"])
    op.create_index("ix_event_outbox_organization_id", "event_outbox", ["organization_id"])
    op.create_index("ix_event_outbox_event_id", "event_outbox", ["event_id"])
    op.create_index("ix_event_outbox_status", "event_outbox", ["status"])
    op.create_index("ix_event_outbox_run_id", "event_outbox", ["run_id"])
    op.create_index("ix_outbox_status_attempts_created", "event_outbox", ["status", "attempts", "created_at"])

    # 3. Event Processing State Table
    op.create_table(
        "event_processing",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("organization_id", sa.String(length=64), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("event_id", sa.String(length=64), sa.ForeignKey("canonical_events.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("consumer_group", sa.String(length=64), nullable=False),
        sa.Column("run_id", sa.String(length=64), server_default="run_live_001", nullable=False),
        sa.Column("run_type", sa.String(length=32), server_default="LIVE", nullable=False),
        sa.Column("status", sa.String(length=32), server_default="PENDING", nullable=False),
        sa.Column("attempt_count", sa.Integer(), server_default="1", nullable=False),
        sa.Column("worker_id", sa.String(length=128), server_default="worker-1", nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("error_code", sa.String(length=64), nullable=True),
        sa.Column("first_attempt_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_event_processing_id", "event_processing", ["id"])
    op.create_index("ix_event_processing_organization_id", "event_processing", ["organization_id"])
    op.create_index("ix_event_processing_event_id", "event_processing", ["event_id"])
    op.create_index("ix_event_processing_consumer_group", "event_processing", ["consumer_group"])
    op.create_index("ix_event_processing_run_id", "event_processing", ["run_id"])
    op.create_index("ix_event_processing_status", "event_processing", ["status"])
    op.create_index("ix_event_proc_group_status", "event_processing", ["consumer_group", "status"])
    op.create_index("ix_event_proc_retry", "event_processing", ["status", "next_retry_at"])
    op.create_unique_constraint("uq_event_group_run", "event_processing", ["event_id", "consumer_group", "run_id"])

    # 4. Event Dead Letters Table
    op.create_table(
        "event_dead_letters",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("organization_id", sa.String(length=64), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("event_id", sa.String(length=64), sa.ForeignKey("canonical_events.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("consumer_group", sa.String(length=64), nullable=False),
        sa.Column("run_id", sa.String(length=64), server_default="run_live_001", nullable=False),
        sa.Column("failure_reason", sa.String(length=255), nullable=False),
        sa.Column("error_details", sa.Text(), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="5", nullable=False),
        sa.Column("payload_snapshot", sa.Text(), nullable=False),
        sa.Column("failed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolution_status", sa.String(length=32), server_default="UNRESOLVED", nullable=False),
    )
    op.create_index("ix_event_dead_letters_id", "event_dead_letters", ["id"])
    op.create_index("ix_event_dead_letters_organization_id", "event_dead_letters", ["organization_id"])
    op.create_index("ix_event_dead_letters_event_id", "event_dead_letters", ["event_id"])
    op.create_index("ix_event_dead_letters_consumer_group", "event_dead_letters", ["consumer_group"])
    op.create_index("ix_event_dead_letters_failed_at", "event_dead_letters", ["failed_at"])
    op.create_index("ix_dead_letters_org_group", "event_dead_letters", ["organization_id", "consumer_group", "resolution_status"])


def downgrade() -> None:
    op.drop_table("event_dead_letters")
    op.drop_table("event_processing")
    op.drop_table("event_outbox")
    op.drop_table("canonical_events")
