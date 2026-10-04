"""Slack multi-user OAuth connections and continuous polling state

Revision ID: 005_slack_connections
Revises: 004_event_platform
Create Date: 2026-10-03 12:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "005_slack_connections"
down_revision: Union[str, None] = "004_event_platform"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "slack_connections",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("user_id", sa.String(length=64), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("slack_team_id", sa.String(length=64), nullable=False),
        sa.Column("slack_user_id", sa.String(length=64), nullable=True),
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="1", nullable=False),
        sa.Column("cursor_state", sa.Text(), server_default="{}", nullable=False),
        sa.Column("last_polled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_slack_connections_id", "slack_connections", ["id"])
    op.create_index("ix_slack_connections_user_id", "slack_connections", ["user_id"])
    op.create_index("ix_slack_connections_slack_team_id", "slack_connections", ["slack_team_id"])
    op.create_index("ix_slack_connections_is_active", "slack_connections", ["is_active"])
    op.create_index("ix_slack_conn_user_team", "slack_connections", ["user_id", "slack_team_id"])
    op.create_index("ix_slack_conn_user_active", "slack_connections", ["user_id", "is_active"])


def downgrade() -> None:
    op.drop_index("ix_slack_conn_user_active", table_name="slack_connections")
    op.drop_index("ix_slack_conn_user_team", table_name="slack_connections")
    op.drop_index("ix_slack_connections_is_active", table_name="slack_connections")
    op.drop_index("ix_slack_connections_slack_team_id", table_name="slack_connections")
    op.drop_index("ix_slack_connections_user_id", table_name="slack_connections")
    op.drop_index("ix_slack_connections_id", table_name="slack_connections")
    op.drop_table("slack_connections")
