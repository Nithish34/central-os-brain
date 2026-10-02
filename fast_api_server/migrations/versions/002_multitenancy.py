"""Multi-tenancy: organizations, users, audit_logs and tenant isolation

Revision ID: 002_multitenancy
Revises: 001_core_schema
Create Date: 2026-09-21 20:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "002_multitenancy"
down_revision: Union[str, None] = "001_core_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Organizations table
    op.create_table(
        "organizations",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=255), nullable=False),
        sa.Column("domain", sa.String(length=255), nullable=True),
        sa.Column("plan", sa.String(length=64), server_default="enterprise", nullable=False),
        sa.Column("deactivated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_organizations_id", "organizations", ["id"])
    op.create_index("ix_organizations_slug", "organizations", ["slug"], unique=True)
    op.create_index("ix_organizations_domain", "organizations", ["domain"])

    # 2. Users table
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("organization_id", sa.String(length=64), sa.ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=True),
        sa.Column("full_name", sa.String(length=255), server_default="", nullable=False),
        sa.Column("avatar_url", sa.String(length=512), nullable=True),
        sa.Column("role", sa.String(length=32), server_default="employee", nullable=False),
        sa.Column("auth_provider", sa.String(length=32), server_default="local", nullable=False),
        sa.Column("auth_provider_id", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_organization_id", "users", ["organization_id"])
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_role", "users", ["role"])
    op.create_index("ix_users_org_email", "users", ["organization_id", "email"], unique=True)

    # 3. Audit logs table (RESTRICT ondelete to preserve compliance records)
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("organization_id", sa.String(length=64), sa.ForeignKey("organizations.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("actor_id", sa.String(length=64), nullable=True),
        sa.Column("actor", sa.String(length=255), server_default="System", nullable=False),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("target", sa.String(length=255), server_default="", nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("reason", sa.Text(), server_default="", nullable=False),
        sa.Column("details_json", sa.Text(), server_default="{}", nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("evidence_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("detected_by", sa.String(length=128), server_default="", nullable=False),
        sa.Column("risk_level", sa.String(length=64), server_default="LOW", nullable=False),
        sa.Column("layer", sa.String(length=128), server_default="Security & Audit", nullable=False),
    )
    op.create_index("ix_audit_logs_id", "audit_logs", ["id"])
    op.create_index("ix_audit_logs_organization_id", "audit_logs", ["organization_id"])
    op.create_index("ix_audit_logs_actor_id", "audit_logs", ["actor_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_timestamp", "audit_logs", ["timestamp"])

    # 4. Add organization_id to operational tables with ondelete CASCADE
    tables_to_scope = [
        "documents",
        "document_chunks",
        "events",
        "conflicts",
        "agents",
        "workflow_actions",
        "chat_sessions",
        "chat_messages",
    ]

    for tbl in tables_to_scope:
        op.add_column(tbl, sa.Column("organization_id", sa.String(length=64), nullable=True))
        # Seed default org for existing rows if any, then make nullable=False
        op.execute(f"UPDATE {tbl} SET organization_id = 'org-default' WHERE organization_id IS NULL")
        with op.batch_alter_table(tbl) as batch_op:
            batch_op.alter_column("organization_id", nullable=False)
            batch_op.create_foreign_key(
                f"fk_{tbl}_organization_id",
                "organizations",
                ["organization_id"],
                ["id"],
                ondelete="CASCADE",
            )
            batch_op.create_index(f"ix_{tbl}_organization_id", ["organization_id"])


def downgrade() -> None:
    tables_to_scope = [
        "chat_messages",
        "chat_sessions",
        "workflow_actions",
        "agents",
        "conflicts",
        "events",
        "document_chunks",
        "documents",
    ]

    for tbl in tables_to_scope:
        with op.batch_alter_table(tbl) as batch_op:
            batch_op.drop_index(f"ix_{tbl}_organization_id")
            batch_op.drop_constraint(f"fk_{tbl}_organization_id", type_="foreignkey")
            batch_op.drop_column("organization_id")

    op.drop_table("audit_logs")
    op.drop_table("users")
    op.drop_table("organizations")
