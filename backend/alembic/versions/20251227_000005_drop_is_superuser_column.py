"""Drop is_superuser column from users table.

Superuser access is now determined by having the 'superuser' role
instead of a dedicated flag on the user model.

Revision ID: 20251227_000005
Revises: 20251227_000004
Create Date: 2024-12-27
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20251227_000005"
down_revision: Union[str, None] = "20251227_000004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop the is_superuser column from users table."""
    op.drop_column("users", "is_superuser")


def downgrade() -> None:
    """Re-add the is_superuser column to users table."""
    op.add_column(
        "users",
        sa.Column(
            "is_superuser",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )
