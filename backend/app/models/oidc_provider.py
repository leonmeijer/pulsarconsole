"""OIDC Provider model for environment authentication."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.environment import Environment


class OIDCProvider(BaseModel):
    """OIDC Provider configuration for an environment."""

    __tablename__ = "oidc_providers"

    # Environment reference (one provider per environment)
    environment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("environments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    # OIDC Configuration
    issuer_url: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
        doc="OIDC issuer URL (e.g., https://auth.example.com)",
    )
    client_id: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="OIDC client ID",
    )
    client_secret_encrypted: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        doc="Fernet-encrypted OIDC client secret (optional when using PKCE)",
    )

    # PKCE Configuration
    use_pkce: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        doc="Use PKCE (Proof Key for Code Exchange) for enhanced security",
    )

    # OIDC Scopes
    scopes: Mapped[list[str]] = mapped_column(
        ARRAY(String),
        nullable=False,
        default=["openid", "profile", "email"],
        doc="OIDC scopes to request",
    )

    # Role mapping configuration
    role_claim: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="groups",
        doc="OIDC claim to use for role mapping (e.g., 'groups', 'roles')",
    )

    # Auto-provisioning settings
    auto_create_users: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        doc="Automatically create users on first login",
    )
    default_role_name: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        doc="Default role to assign to new users",
    )

    # Group-to-role mapping configuration
    # JSON object mapping OIDC group names to role names: {"oidc_group": "role_name"}
    group_role_mappings: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        default=None,
        doc="Mapping of OIDC groups to role names (e.g., {'developers': 'operator'})",
    )
    # OIDC groups that grant global admin access for this provider
    admin_groups: Mapped[list[str] | None] = mapped_column(
        ARRAY(String),
        nullable=True,
        default=None,
        doc="OIDC groups that grant global admin access",
    )
    # Whether to sync roles from OIDC groups on every login
    sync_roles_on_login: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        doc="Sync roles from OIDC groups on every login (revokes roles not in groups)",
    )

    # Status
    is_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    # Relationships
    environment: Mapped["Environment"] = relationship(
        "Environment",
        back_populates="oidc_provider",
    )

    def __repr__(self) -> str:
        return f"<OIDCProvider(environment_id='{self.environment_id}', issuer='{self.issuer_url}')>"
