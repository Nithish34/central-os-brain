"""Core schema: pgvector and prototype tables

Revision ID: 001_core_schema
Revises: 
Create Date: 2026-09-21 20:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "001_core_schema"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enable pgvector extension if on postgres dialect
    conn = op.get_bind()
    if conn.dialect.name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # 2. Documents table
    op.create_table(
        "documents",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("source", sa.String(length=64), nullable=False),
        sa.Column("type", sa.String(length=64), server_default="official_document", nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("author", sa.String(length=255), nullable=False),
        sa.Column("owner", sa.String(length=255), nullable=False),
        sa.Column("timestamp", sa.String(length=64), nullable=False),
        sa.Column("authority_score", sa.Float(), server_default="0.8", nullable=False),
        sa.Column("freshness_score", sa.Float(), server_default="0.5", nullable=False),
        sa.Column("status", sa.String(length=32), server_default="stale", nullable=False),
        sa.Column("tags", sa.Text(), server_default="[]", nullable=False),
        sa.Column("chunk_count", sa.Integer(), server_default="4", nullable=False),
        sa.Column("graph_node_id", sa.String(length=128), nullable=True),
        sa.Column("embedding_model", sa.String(length=128), server_default="text-embedding-3-small", nullable=False),
        sa.Column("storage_backend", sa.String(length=64), server_default="postgres", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_documents_id", "documents", ["id"])
    op.create_index("ix_documents_source", "documents", ["source"])
    op.create_index("ix_documents_owner", "documents", ["owner"])
    op.create_index("ix_documents_status", "documents", ["status"])

    # 3. Document chunks table
    op.create_table(
        "document_chunks",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("document_id", sa.String(length=64), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding_json", sa.Text(), nullable=True),
        sa.Column("token_count", sa.Integer(), server_default="128", nullable=False),
    )
    op.create_index("ix_document_chunks_id", "document_chunks", ["id"])
    op.create_index("ix_document_chunks_document_id", "document_chunks", ["document_id"])

    # 4. Events table
    op.create_table(
        "events",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("provider_event_id", sa.String(length=255), nullable=True),
        sa.Column("source", sa.String(length=64), nullable=False),
        sa.Column("type", sa.String(length=64), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("author", sa.String(length=255), nullable=False),
        sa.Column("owner", sa.String(length=255), nullable=False),
        sa.Column("timestamp", sa.String(length=64), nullable=False),
        sa.Column("authority_score", sa.Float(), server_default="0.85", nullable=False),
        sa.Column("freshness_score", sa.Float(), server_default="0.95", nullable=False),
        sa.Column("tags", sa.Text(), server_default="[]", nullable=False),
        sa.Column("pipeline_stage", sa.String(length=64), server_default="processed", nullable=False),
        sa.Column("event_type_normalized", sa.String(length=64), server_default="operational_decision", nullable=False),
        sa.Column("ingestion_source", sa.String(length=64), server_default="connector", nullable=False),
        sa.Column("vector_indexed", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_events_id", "events", ["id"])
    op.create_index("ix_events_source", "events", ["source"])
    op.create_index("ix_events_owner", "events", ["owner"])
    op.create_index("ix_events_provider_event_id", "events", ["provider_event_id"])

    # 5. Conflicts table
    op.create_table(
        "conflicts",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("severity", sa.String(length=32), server_default="medium", nullable=False),
        sa.Column("domain", sa.String(length=128), nullable=False),
        sa.Column("document_id", sa.String(length=64), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("evidence_ids", sa.Text(), server_default="[]", nullable=False),
        sa.Column("old_claim", sa.Text(), nullable=False),
        sa.Column("new_claim", sa.Text(), nullable=False),
        sa.Column("recommended_update", sa.Text(), nullable=False),
        sa.Column("business_impact", sa.Text(), nullable=False),
        sa.Column("owner", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="open", nullable=False),
        sa.Column("detected_by", sa.String(length=128), server_default="agent-engineering", nullable=False),
        sa.Column("contradiction_score", sa.Float(), server_default="0.85", nullable=False),
        sa.Column("freshness_delta", sa.Float(), server_default="0.4", nullable=False),
        sa.Column("authority_delta", sa.Float(), server_default="0.05", nullable=False),
        sa.Column("graph_hops", sa.Integer(), server_default="1", nullable=False),
        sa.Column("risk_level", sa.String(length=32), server_default="MEDIUM", nullable=False),
        sa.Column("approval_matrix", sa.Text(), server_default="{}", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_conflicts_id", "conflicts", ["id"])
    op.create_index("ix_conflicts_domain", "conflicts", ["domain"])
    op.create_index("ix_conflicts_severity", "conflicts", ["severity"])
    op.create_index("ix_conflicts_status", "conflicts", ["status"])
    op.create_index("ix_conflicts_document_id", "conflicts", ["document_id"])

    # 6. Agents table
    op.create_table(
        "agents",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("icon", sa.String(length=32), server_default="🤖", nullable=False),
        sa.Column("domain", sa.String(length=128), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="active", nullable=False),
        sa.Column("conflicts_detected", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_detection", sa.String(length=64), nullable=True),
        sa.Column("memory_entries", sa.Integer(), server_default="10", nullable=False),
        sa.Column("tasks_completed", sa.Integer(), server_default="0", nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("detected_conflict_ids", sa.Text(), server_default="[]", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_agents_id", "agents", ["id"])
    op.create_index("ix_agents_domain", "agents", ["domain"])

    # 7. Workflow actions table
    op.create_table(
        "workflow_actions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("conflict_id", sa.String(length=64), sa.ForeignKey("conflicts.id", ondelete="CASCADE"), nullable=True),
        sa.Column("layer", sa.String(length=128), server_default="Layer 0 — Execution", nullable=False),
        sa.Column("tool", sa.String(length=128), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=32), server_default="completed", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_workflow_actions_id", "workflow_actions", ["id"])
    op.create_index("ix_workflow_actions_conflict_id", "workflow_actions", ["conflict_id"])

    # 8. Chat sessions and messages
    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("title", sa.String(length=255), server_default="New Conversation", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_active", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("message_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("is_archived", sa.Boolean(), server_default=sa.false(), nullable=False),
    )
    op.create_index("ix_chat_sessions_id", "chat_sessions", ["id"])
    op.create_index("ix_chat_sessions_last_active", "chat_sessions", ["last_active"])

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("session_id", sa.String(length=64), sa.ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("engine", sa.String(length=64), nullable=True),
        sa.Column("sources", sa.Text(), server_default="[]", nullable=False),
    )
    op.create_index("ix_chat_messages_id", "chat_messages", ["id"])
    op.create_index("ix_chat_messages_session_id", "chat_messages", ["session_id"])


def downgrade() -> None:
    op.drop_table("chat_messages")
    op.drop_table("chat_sessions")
    op.drop_table("workflow_actions")
    op.drop_table("agents")
    op.drop_table("conflicts")
    op.drop_table("events")
    op.drop_table("document_chunks")
    op.drop_table("documents")
