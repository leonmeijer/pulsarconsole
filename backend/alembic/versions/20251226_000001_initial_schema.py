"""Initial database schema.

Revision ID: 20251226_000001
Revises:
Create Date: 2025-12-26 00:00:01.000000+00:00

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "20251226_000001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create initial database schema."""

    # Create environments table
    op.create_table(
        "environments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("admin_url", sa.String(512), nullable=False),
        sa.Column(
            "auth_mode",
            sa.Enum("none", "token", "tls", name="authmode"),
            nullable=False,
            server_default="none",
        ),
        sa.Column("token_encrypted", sa.Text, nullable=True),
        sa.Column("ca_bundle_ref", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # Create audit_events table
    op.create_table(
        "audit_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("action", sa.String(100), nullable=False, index=True),
        sa.Column("resource_type", sa.String(100), nullable=False, index=True),
        sa.Column("resource_id", sa.String(512), nullable=False),
        sa.Column("request_params", postgresql.JSONB, nullable=True),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column(
            "timestamp",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
            index=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "idx_audit_resource",
        "audit_events",
        ["resource_type", "resource_id"],
    )

    # Create topic_stats table
    op.create_table(
        "topic_stats",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "environment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("environments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tenant", sa.String(255), nullable=False),
        sa.Column("namespace", sa.String(255), nullable=False),
        sa.Column("topic", sa.String(512), nullable=False),
        sa.Column("partition_count", sa.Integer, nullable=False, server_default="1"),
        sa.Column("msg_rate_in", sa.Float, nullable=False, server_default="0"),
        sa.Column("msg_rate_out", sa.Float, nullable=False, server_default="0"),
        sa.Column("msg_throughput_in", sa.Float, nullable=False, server_default="0"),
        sa.Column("msg_throughput_out", sa.Float, nullable=False, server_default="0"),
        sa.Column("storage_size", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("backlog_size", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column(
            "collected_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("idx_topic_stats_collected", "topic_stats", ["collected_at"])
    op.create_index(
        "idx_topic_stats_topic", "topic_stats", ["tenant", "namespace", "topic"]
    )
    op.create_index("idx_topic_stats_env", "topic_stats", ["environment_id"])

    # Create subscription_stats table
    op.create_table(
        "subscription_stats",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "environment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("environments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tenant", sa.String(255), nullable=False),
        sa.Column("namespace", sa.String(255), nullable=False),
        sa.Column("topic", sa.String(512), nullable=False),
        sa.Column("subscription", sa.String(255), nullable=False),
        sa.Column("msg_rate_out", sa.Float, nullable=False, server_default="0"),
        sa.Column("msg_throughput_out", sa.Float, nullable=False, server_default="0"),
        sa.Column("msg_backlog", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("consumer_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "collected_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "idx_sub_stats_collected", "subscription_stats", ["collected_at"]
    )
    op.create_index(
        "idx_sub_stats_subscription",
        "subscription_stats",
        ["tenant", "namespace", "topic", "subscription"],
    )
    op.create_index("idx_sub_stats_env", "subscription_stats", ["environment_id"])

    # Create broker_stats table
    op.create_table(
        "broker_stats",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "environment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("environments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("broker_url", sa.String(512), nullable=False),
        sa.Column("cpu_usage", sa.Float, nullable=False, server_default="0"),
        sa.Column("memory_usage", sa.Float, nullable=False, server_default="0"),
        sa.Column("direct_memory_usage", sa.Float, nullable=False, server_default="0"),
        sa.Column("msg_rate_in", sa.Float, nullable=False, server_default="0"),
        sa.Column("msg_rate_out", sa.Float, nullable=False, server_default="0"),
        sa.Column("connection_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column(
            "collected_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("idx_broker_stats_collected", "broker_stats", ["collected_at"])
    op.create_index("idx_broker_stats_broker", "broker_stats", ["broker_url"])
    op.create_index("idx_broker_stats_env", "broker_stats", ["environment_id"])

    # Create aggregations table
    op.create_table(
        "aggregations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "environment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("environments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("aggregation_type", sa.String(50), nullable=False),
        sa.Column("aggregation_key", sa.String(512), nullable=False),
        sa.Column("topic_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("total_backlog", sa.BigInteger, nullable=False, server_default="0"),
        sa.Column("total_msg_rate_in", sa.Float, nullable=False, server_default="0"),
        sa.Column("total_msg_rate_out", sa.Float, nullable=False, server_default="0"),
        sa.Column(
            "total_storage_size", sa.BigInteger, nullable=False, server_default="0"
        ),
        sa.Column(
            "computed_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "idx_agg_type_key", "aggregations", ["aggregation_type", "aggregation_key"]
    )
    op.create_index("idx_agg_computed", "aggregations", ["computed_at"])
    op.create_index("idx_agg_env", "aggregations", ["environment_id"])


def downgrade() -> None:
    """Drop all tables."""
    op.drop_table("aggregations")
    op.drop_table("broker_stats")
    op.drop_table("subscription_stats")
    op.drop_table("topic_stats")
    op.drop_table("audit_events")
    op.drop_table("environments")
    op.execute("DROP TYPE IF EXISTS authmode")
