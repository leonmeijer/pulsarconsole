"""Tenant schemas."""

from pydantic import Field

from app.schemas.common import BaseSchema, StatsBase


class TenantBase(BaseSchema):
    """Base tenant schema."""

    name: str = Field(..., min_length=1, max_length=64, description="Tenant name")


class TenantCreate(TenantBase):
    """Schema for creating a tenant."""

    admin_roles: list[str] | None = Field(
        default=None, description="Admin roles for the tenant"
    )
    allowed_clusters: list[str] | None = Field(
        default=None, description="Allowed clusters for the tenant"
    )


class TenantUpdate(BaseSchema):
    """Schema for updating a tenant."""

    admin_roles: list[str] | None = Field(
        default=None, description="Admin roles for the tenant"
    )
    allowed_clusters: list[str] | None = Field(
        default=None, description="Allowed clusters for the tenant"
    )


class TenantResponse(TenantBase, StatsBase):
    """Tenant response schema."""

    admin_roles: list[str] = Field(default_factory=list)
    allowed_clusters: list[str] = Field(default_factory=list)
    namespace_count: int = 0
    topic_count: int = 0
    total_backlog: int = 0


class TenantDetailResponse(TenantResponse):
    """Detailed tenant response with namespaces."""

    namespaces: list[str] = Field(default_factory=list)
    total_storage_size: int = 0


class TenantListResponse(BaseSchema):
    """Response for tenant list."""

    tenants: list[TenantResponse]
    total: int
