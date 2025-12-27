"""Add is_active field to environments table.

Revision ID: 20251227_000001
Revises: 20251226_000001
Create Date: 2024-12-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "20251227_000001"
down_revision: Union[str, None] = "20251226_000001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_active column with default False
    op.add_column(
        "environments",
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_index(op.f("ix_environments_is_active"), "environments", ["is_active"])

    # Set the first environment (if any) as active
    op.execute(
        """
        UPDATE environments
        SET is_active = true
        WHERE id = (SELECT id FROM environments ORDER BY created_at LIMIT 1)
        """
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_environments_is_active"), table_name="environments")
    op.drop_column("environments", "is_active")
