"""Environment configuration schemas."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.common import BaseSchema


class EnvironmentBase(BaseSchema):
    """Base environment schema."""

    name: str = Field(..., min_length=1, max_length=64, description="Environment name")
    admin_url: str = Field(..., description="Pulsar admin URL")


class EnvironmentCreate(EnvironmentBase):
    """Schema for creating an environment."""

    auth_mode: Literal["none", "token", "oidc", "tls"] = Field(
        default="none", description="Authentication mode"
    )
    oidc_mode: Literal["none", "console_only", "passthrough"] = Field(
        default="none", description="OIDC operation mode"
    )
    token: str | None = Field(default=None, description="Authentication token")
    superuser_token: str | None = Field(
        default=None,
        description="Superuser token for auth management (if different from regular token)",
    )
    ca_bundle_ref: str | None = Field(
        default=None, description="CA bundle reference for TLS"
    )
    rbac_enabled: bool = Field(
        default=False, description="Enable RBAC for this environment"
    )
    rbac_sync_mode: Literal["console_only", "sync_to_pulsar", "read_from_pulsar"] = Field(
        default="console_only", description="RBAC synchronization mode"
    )
    validate_connectivity: bool = Field(
        default=True, description="Test connectivity before saving"
    )
    is_shared: bool = Field(
        default=True, description="Whether this environment is visible to all users"
    )

    @field_validator("token")
    @classmethod
    def validate_token(cls, v: str | None, info) -> str | None:
        """Validate token is provided when auth_mode is token."""
        if info.data.get("auth_mode") == "token" and not v:
            raise ValueError("Token is required when auth_mode is 'token'")
        return v


class EnvironmentUpdate(BaseSchema):
    """Schema for updating an environment."""

    admin_url: str | None = Field(default=None, description="Pulsar admin URL")
    auth_mode: Literal["none", "token", "oidc", "tls"] | None = Field(
        default=None, description="Authentication mode"
    )
    oidc_mode: Literal["none", "console_only", "passthrough"] | None = Field(
        default=None, description="OIDC operation mode"
    )
    token: str | None = Field(default=None, description="Authentication token")
    superuser_token: str | None = Field(
        default=None,
        description="Superuser token for auth management (if different from regular token)",
    )
    ca_bundle_ref: str | None = Field(
        default=None, description="CA bundle reference for TLS"
    )
    rbac_enabled: bool | None = Field(
        default=None, description="Enable RBAC for this environment"
    )
    rbac_sync_mode: Literal["console_only", "sync_to_pulsar", "read_from_pulsar"] | None = Field(
        default=None, description="RBAC synchronization mode"
    )
    validate_connectivity: bool = Field(
        default=True, description="Test connectivity before saving"
    )
    is_shared: bool | None = Field(
        default=None, description="Whether this environment is visible to all users"
    )


class EnvironmentResponse(EnvironmentBase):
    """Environment response schema."""

    id: UUID
    auth_mode: str
    oidc_mode: str = Field(default="none", description="OIDC operation mode")
    has_token: bool = Field(description="Whether token is configured")
    has_superuser_token: bool = Field(
        default=False, description="Whether superuser token is configured"
    )
    ca_bundle_ref: str | None = None
    is_active: bool = Field(default=False, description="Whether this is the active environment")
    rbac_enabled: bool = Field(default=False, description="Whether RBAC is enabled")
    rbac_sync_mode: str = Field(
        default="console_only", description="RBAC synchronization mode"
    )
    is_shared: bool = Field(default=True, description="Whether this environment is visible to all users")
    created_by_id: UUID | None = Field(default=None, description="User who created this environment")
    created_at: datetime
    updated_at: datetime | None = None


class EnvironmentListResponse(BaseSchema):
    """Response schema for listing environments."""

    environments: list[EnvironmentResponse]
    total: int


class EnvironmentTestRequest(BaseSchema):
    """Schema for testing environment connectivity."""

    admin_url: str = Field(..., description="Pulsar admin URL to test")
    token: str | None = Field(default=None, description="Authentication token")


class EnvironmentTestResponse(BaseSchema):
    """Schema for environment connectivity test result."""

    success: bool
    message: str
    latency_ms: float | None = None


# =============================================================================
# OIDC Provider Configuration Schemas
# =============================================================================


class GroupRoleMapping(BaseSchema):
    """Mapping of an OIDC group to an internal role."""

    oidc_group: str = Field(..., description="OIDC group name")
    role_name: str = Field(..., description="Internal role name to assign")


class OIDCProviderCreate(BaseSchema):
    """Schema for creating an OIDC provider configuration."""

    issuer_url: str = Field(..., description="OIDC issuer URL")
    client_id: str = Field(..., description="OIDC client ID")
    client_secret: str | None = Field(default=None, description="OIDC client secret (optional with PKCE)")
    use_pkce: bool = Field(default=True, description="Use PKCE for enhanced security")
    scopes: list[str] = Field(default=["openid", "profile", "email"], description="OIDC scopes to request")
    role_claim: str = Field(default="groups", description="Claim name containing user groups")
    auto_create_users: bool = Field(default=True, description="Auto-create users on first login")
    default_role_name: str | None = Field(default=None, description="Default role for new users")
    group_role_mappings: dict[str, str] | None = Field(
        default=None,
        description="Mapping of OIDC groups to role names (e.g., {'developers': 'operator'})",
    )
    admin_groups: list[str] | None = Field(
        default=None,
        description="OIDC groups that grant global admin access",
    )
    sync_roles_on_login: bool = Field(
        default=True,
        description="Sync roles from OIDC groups on every login",
    )


class OIDCProviderUpdate(BaseSchema):
    """Schema for updating an OIDC provider configuration."""

    issuer_url: str | None = Field(default=None, description="OIDC issuer URL")
    client_id: str | None = Field(default=None, description="OIDC client ID")
    client_secret: str | None = Field(default=None, description="OIDC client secret")
    use_pkce: bool | None = Field(default=None, description="Use PKCE for enhanced security")
    scopes: list[str] | None = Field(default=None, description="OIDC scopes to request")
    role_claim: str | None = Field(default=None, description="Claim name containing user groups")
    auto_create_users: bool | None = Field(default=None, description="Auto-create users on first login")
    default_role_name: str | None = Field(default=None, description="Default role for new users")
    group_role_mappings: dict[str, str] | None = Field(
        default=None,
        description="Mapping of OIDC groups to role names",
    )
    admin_groups: list[str] | None = Field(
        default=None,
        description="OIDC groups that grant global admin access",
    )
    sync_roles_on_login: bool | None = Field(
        default=None,
        description="Sync roles from OIDC groups on every login",
    )
    is_enabled: bool | None = Field(default=None, description="Enable/disable OIDC provider")


class OIDCProviderResponse(BaseSchema):
    """Response schema for OIDC provider configuration."""

    id: str | UUID  # Can be UUID or string (for virtual providers)
    environment_id: UUID
    issuer_url: str
    client_id: str
    has_client_secret: bool = Field(description="Whether client secret is configured")
    use_pkce: bool
    scopes: list[str]
    role_claim: str
    auto_create_users: bool
    default_role_name: str | None
    group_role_mappings: dict[str, str] | None
    admin_groups: list[str] | None
    sync_roles_on_login: bool
    is_enabled: bool
    created_at: datetime | None = None  # None for virtual providers from global config
    updated_at: datetime | None = None
    is_global: bool = Field(
        default=False,
        description="Whether this provider config is from global environment variables",
    )
