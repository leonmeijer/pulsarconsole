"""Fix notifications table.

Adds missing updated_at column to notifications table.

Revision ID: 005
Revises: 004
Create Date: 2025-12-30
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add updated_at column to notifications table."""
    # Check if column already exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("notifications")]
    
    if "updated_at" not in columns:
        op.add_column(
            "notifications",
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
        )


def downgrade() -> None:
    """Remove updated_at column from notifications table."""
    op.drop_column("notifications", "updated_at")

