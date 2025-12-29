"""Authentication and RBAC tables.

Creates tables for user authentication and role-based access control:
- users: OIDC-authenticated users
- sessions: User sessions with tokens
- permissions: Available permission types
- roles: Per-environment roles
- role_permissions: Role to permission mappings
- user_roles: User to role assignments
- api_tokens: API access tokens
- oidc_providers: OIDC provider configurations

Also adds RBAC-related columns to environments table.

Revision ID: 002
Revises: 001
Create Date: 2025-12-27
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add authentication and RBAC tables and columns."""

    # Create new enum types (idempotent)
    conn = op.get_bind()
    
    for enum_name, enum_values in [
        ("oidcmode", "('none', 'console_only', 'passthrough')"),
        ("rbacsyncmode", "('console_only', 'sync_to_pulsar', 'read_from_pulsar')"),
        ("permissionaction", "('produce', 'consume', 'functions', 'sources', 'sinks', 'packages', 'admin', 'read', 'write')"),
        ("resourcelevel", "('cluster', 'tenant', 'namespace', 'topic')"),
    ]:
        result = conn.execute(
            sa.text(f"SELECT 1 FROM pg_type WHERE typname = '{enum_name}'")
        ).fetchone()
        if not result:
            op.execute(f"CREATE TYPE {enum_name} AS ENUM {enum_values}")

    # Add new columns to environments table
    op.add_column(
        "environments",
        sa.Column(
            "rbac_enabled",
            sa.Boolean(),
            nullable=False,
            server_default="false"
        )
    )
    op.add_column(
        "environments",
        sa.Column(
            "oidc_mode",
            postgresql.ENUM("none", "console_only", "passthrough", name="oidcmode", create_type=False),
            nullable=False,
            server_default="none"
        )
    )
    op.add_column(
        "environments",
        sa.Column(
            "rbac_sync_mode",
            postgresql.ENUM("console_only", "sync_to_pulsar", "read_from_pulsar", name="rbacsyncmode", create_type=False),
            nullable=False,
            server_default="console_only"
        )
    )
    op.add_column(
        "environments",
        sa.Column("service_account_token_encrypted", sa.Text(), nullable=True)
    )
    op.add_column(
        "environments",
        sa.Column("pulsar_token_secret_key_encrypted", sa.Text(), nullable=True)
    )
    op.add_column(
        "environments",
        sa.Column("superuser_token_encrypted", sa.Text(), nullable=True)
    )

    # Create users table (NO is_superuser - superuser access is via role)
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), unique=True, nullable=False, index=True),
        sa.Column("subject", sa.String(255), nullable=False),
        sa.Column("issuer", sa.String(512), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=True),
        sa.Column("avatar_url", sa.String(1024), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now()
        ),
    )
    op.create_index("idx_users_subject_issuer", "users", ["subject", "issuer"], unique=True)

    # Create sessions table
    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True
        ),
        sa.Column("access_token_hash", sa.String(64), nullable=False, index=True),
        sa.Column("refresh_token_encrypted", sa.Text(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now()
        ),
    )

    # Create permissions table (lookup table for available permissions)
    op.create_table(
        "permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "action",
            postgresql.ENUM(
                "produce", "consume", "functions", "sources", "sinks", "packages",
                "admin", "read", "write",
                name="permissionaction", create_type=False
            ),
            nullable=False
        ),
        sa.Column(
            "resource_level",
            postgresql.ENUM("cluster", "tenant", "namespace", "topic", name="resourcelevel", create_type=False),
            nullable=False
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now()
        ),
    )
    op.create_index(
        "idx_permissions_action_level",
        "permissions",
        ["action", "resource_level"],
        unique=True
    )

    # Create roles table (per environment)
    op.create_table(
        "roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "environment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("environments.id", ondelete="CASCADE"),
            nullable=False,
            index=True
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now()
        ),
    )
    op.create_index(
        "uq_role_env_name",
        "roles",
        ["environment_id", "name"],
        unique=True
    )

    # Create role_permissions table (many-to-many with resource pattern)
    op.create_table(
        "role_permissions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "role_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("roles.id", ondelete="CASCADE"),
            nullable=False,
            index=True
        ),
        sa.Column(
            "permission_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("permissions.id", ondelete="CASCADE"),
            nullable=False,
            index=True
        ),
        sa.Column("resource_pattern", sa.String(512), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now()
        ),
    )
    op.create_index(
        "uq_role_perm_resource",
        "role_permissions",
        ["role_id", "permission_id", "resource_pattern"],
        unique=True
    )

    # Create user_roles table (many-to-many)
    op.create_table(
        "user_roles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True
        ),
        sa.Column(
            "role_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("roles.id", ondelete="CASCADE"),
            nullable=False,
            index=True
        ),
        sa.Column(
            "assigned_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now()
        ),
    )
    op.create_index(
        "uq_user_role",
        "user_roles",
        ["user_id", "role_id"],
        unique=True
    )

    # Create api_tokens table
    op.create_table(
        "api_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            index=True
        ),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column("token_prefix", sa.String(8), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True, index=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_revoked", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("scopes", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now()
        ),
    )

    # Create oidc_providers table (with PKCE support)
    op.create_table(
        "oidc_providers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "environment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("environments.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
            index=True
        ),
        sa.Column("issuer_url", sa.String(512), nullable=False),
        sa.Column("client_id", sa.String(255), nullable=False),
        sa.Column("client_secret_encrypted", sa.Text(), nullable=True),  # Nullable for PKCE
        sa.Column("use_pkce", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "scopes",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default="{openid,profile,email}"
        ),
        sa.Column("role_claim", sa.String(100), nullable=False, server_default="groups"),
        sa.Column("auto_create_users", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("default_role_name", sa.String(100), nullable=True),
        sa.Column("is_enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now()
        ),
    )


def downgrade() -> None:
    """Remove authentication and RBAC tables and columns."""

    # Drop tables in reverse order (respecting foreign keys)
    op.drop_table("oidc_providers")
    op.drop_table("api_tokens")
    op.drop_table("user_roles")
    op.drop_table("role_permissions")
    op.drop_table("roles")
    op.drop_table("permissions")
    op.drop_table("sessions")
    op.drop_table("users")

    # Drop environment columns
    op.drop_column("environments", "superuser_token_encrypted")
    op.drop_column("environments", "pulsar_token_secret_key_encrypted")
    op.drop_column("environments", "service_account_token_encrypted")
    op.drop_column("environments", "rbac_sync_mode")
    op.drop_column("environments", "oidc_mode")
    op.drop_column("environments", "rbac_enabled")

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS resourcelevel")
    op.execute("DROP TYPE IF EXISTS permissionaction")
    op.execute("DROP TYPE IF EXISTS rbacsyncmode")
    op.execute("DROP TYPE IF EXISTS oidcmode")
