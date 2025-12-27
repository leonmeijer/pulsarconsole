"""Add notifications table.

Revision ID: 20251227_000002
Revises: 20251227_000001
Create Date: 2025-12-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20251227_000002"
down_revision: Union[str, None] = "20251227_000001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create notifications table."""
    op.create_table(
        "notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("type", sa.String(50), nullable=False, index=True),
        sa.Column("severity", sa.String(20), nullable=False, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("message", sa.Text, nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=True),
        sa.Column("resource_id", sa.String(512), nullable=True),
        sa.Column("metadata", postgresql.JSONB, nullable=True),
        sa.Column("is_read", sa.Boolean, nullable=False, default=False),
        sa.Column("is_dismissed", sa.Boolean, nullable=False, default=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )

    # Create indexes
    op.create_index(
        "idx_notification_unread",
        "notifications",
        ["is_read", "is_dismissed"],
    )
    op.create_index(
        "idx_notification_type_severity",
        "notifications",
        ["type", "severity"],
    )
    op.create_index(
        "idx_notification_created_desc",
        "notifications",
        [sa.text("created_at DESC")],
    )


def downgrade() -> None:
    """Drop notifications table."""
    op.drop_index("idx_notification_created_desc", table_name="notifications")
    op.drop_index("idx_notification_type_severity", table_name="notifications")
    op.drop_index("idx_notification_unread", table_name="notifications")
    op.drop_table("notifications")
