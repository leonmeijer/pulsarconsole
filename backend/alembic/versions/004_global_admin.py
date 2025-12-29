"""Add is_global_admin to users table.

This migration adds a global admin flag to users that allows
the first user to have full access even when no environments exist.

Revision ID: 004
Revises: bec3b9a65fc5
Create Date: 2025-12-29
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: Union[str, None] = "bec3b9a65fc5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add is_global_admin column to users table."""
    op.add_column(
        "users",
        sa.Column(
            "is_global_admin",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    """Remove is_global_admin column from users table."""
    op.drop_column("users", "is_global_admin")

