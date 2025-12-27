"""Namespace schemas."""

from pydantic import Field

from app.schemas.common import BaseSchema, StatsBase


class NamespacePolicies(BaseSchema):
    """Namespace policies schema."""

    retention_time_minutes: int | None = Field(
        default=None, description="Retention time in minutes"
    )
    retention_size_mb: int | None = Field(
        default=None, description="Retention size in MB"
    )
    message_ttl_seconds: int | None = Field(
        default=None, description="Message TTL in seconds"
    )
    backlog_quota: dict | None = Field(default=None, description="Backlog quota settings")
    deduplication_enabled: bool | None = Field(
        default=None, description="Whether deduplication is enabled"
    )
    schema_compatibility_strategy: str | None = Field(
        default=None, description="Schema compatibility strategy"
    )


class NamespaceBase(BaseSchema):
    """Base namespace schema."""

    namespace: str = Field(..., min_length=1, max_length=64, description="Namespace name")


class NamespaceCreate(NamespaceBase):
    """Schema for creating a namespace."""

    pass


class NamespaceUpdate(BaseSchema):
    """Schema for updating namespace policies."""

    retention_time_minutes: int | None = Field(
        default=None, ge=-1, description="Retention time in minutes (-1 for unlimited)"
    )
    retention_size_mb: int | None = Field(
        default=None, ge=-1, description="Retention size in MB (-1 for unlimited)"
    )
    message_ttl_seconds: int | None = Field(
        default=None, ge=0, description="Message TTL in seconds"
    )
    deduplication_enabled: bool | None = Field(
        default=None, description="Whether deduplication is enabled"
    )
    schema_compatibility_strategy: str | None = Field(
        default=None, description="Schema compatibility strategy"
    )


class NamespaceResponse(NamespaceBase, StatsBase):
    """Namespace response schema."""

    tenant: str
    full_name: str
    policies: NamespacePolicies = Field(default_factory=NamespacePolicies)
    topic_count: int = 0
    total_backlog: int = 0
    total_storage_size: int = 0


class NamespaceDetailResponse(NamespaceResponse):
    """Detailed namespace response with topics."""

    persistent_topics: list[str] = Field(default_factory=list)
    non_persistent_topics: list[str] = Field(default_factory=list)


class NamespaceListResponse(BaseSchema):
    """Response for namespace list."""

    namespaces: list[NamespaceResponse]
    total: int
