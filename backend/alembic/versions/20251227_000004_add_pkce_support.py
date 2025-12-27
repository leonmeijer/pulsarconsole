"""Add PKCE support to OIDC providers.

Revision ID: 20251227_000004
Revises: 20251227_000003
Create Date: 2025-12-27

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "20251227_000004"
down_revision: Union[str, None] = "20251227_000003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add PKCE support columns."""
    # Add use_pkce column with default True
    op.add_column(
        "oidc_providers",
        sa.Column(
            "use_pkce",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )

    # Make client_secret_encrypted nullable (not needed when using PKCE)
    op.alter_column(
        "oidc_providers",
        "client_secret_encrypted",
        existing_type=sa.Text(),
        nullable=True,
    )


def downgrade() -> None:
    """Remove PKCE support columns."""
    # Make client_secret_encrypted required again
    op.alter_column(
        "oidc_providers",
        "client_secret_encrypted",
        existing_type=sa.Text(),
        nullable=False,
    )

    # Remove use_pkce column
    op.drop_column("oidc_providers", "use_pkce")
