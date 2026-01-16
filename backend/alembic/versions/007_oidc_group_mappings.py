"""Add OIDC group mapping fields to oidc_providers table.

Revision ID: 007_oidc_group_mappings
Revises: 006_user_theme_preferences
Create Date: 2025-01-16

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, ARRAY


# revision identifiers, used by Alembic.
revision: str = '007_oidc_group_mappings'
down_revision: Union[str, None] = '006_user_theme_preferences'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add group mapping columns to oidc_providers table."""
    # Group-to-role mappings (JSON: {"oidc_group": "role_name", ...})
    op.add_column(
        'oidc_providers',
        sa.Column(
            'group_role_mappings',
            JSONB,
            nullable=True,
        )
    )
    # Admin groups (array of group names that grant global admin)
    op.add_column(
        'oidc_providers',
        sa.Column(
            'admin_groups',
            ARRAY(sa.String),
            nullable=True,
        )
    )
    # Whether to sync roles on every login
    op.add_column(
        'oidc_providers',
        sa.Column(
            'sync_roles_on_login',
            sa.Boolean,
            nullable=False,
            server_default='true',
        )
    )


def downgrade() -> None:
    """Remove group mapping columns from oidc_providers table."""
    op.drop_column('oidc_providers', 'sync_roles_on_login')
    op.drop_column('oidc_providers', 'admin_groups')
    op.drop_column('oidc_providers', 'group_role_mappings')
