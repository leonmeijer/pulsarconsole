"""Add theme preference fields to users table.

Revision ID: 006_user_theme_preferences
Revises: 20251228_191040_bec3b9a65fc5_add_visibility_and_ownership_to_
Create Date: 2024-12-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '006_user_theme_preferences'
down_revision: Union[str, None] = '005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add theme_preference and theme_mode columns to users table."""
    op.add_column(
        'users',
        sa.Column(
            'theme_preference',
            sa.String(50),
            nullable=True,
            server_default='current-dark',
        )
    )
    op.add_column(
        'users',
        sa.Column(
            'theme_mode',
            sa.String(10),
            nullable=True,
            server_default='system',
        )
    )


def downgrade() -> None:
    """Remove theme preference columns."""
    op.drop_column('users', 'theme_mode')
    op.drop_column('users', 'theme_preference')

