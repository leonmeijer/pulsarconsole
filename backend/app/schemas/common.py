"""Common schemas shared across the API."""

from datetime import datetime
from typing import Any, Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class BaseSchema(BaseModel):
    """Base schema with common configuration."""

    model_config = ConfigDict(
        from_attributes=True,
        populate_by_name=True,
    )


class ErrorResponse(BaseSchema):
    """Standard error response."""

    error: str
    message: str
    details: dict[str, Any] | None = None
    request_id: str | None = None


class SuccessResponse(BaseSchema):
    """Standard success response."""

    success: bool = True
    message: str


class PaginatedResponse(BaseSchema, Generic[T]):
    """Paginated response wrapper."""

    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int

    @classmethod
    def create(
        cls,
        items: list[T],
        total: int,
        page: int,
        page_size: int,
    ) -> "PaginatedResponse[T]":
        """Create a paginated response."""
        pages = (total + page_size - 1) // page_size if page_size > 0 else 0
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            pages=pages,
        )


class HealthResponse(BaseSchema):
    """Health check response."""

    status: str
    healthy: bool
    version: str | None = None
    details: dict[str, Any] | None = None


class StatsBase(BaseSchema):
    """Base statistics schema."""

    msg_rate_in: float = Field(default=0, description="Messages per second incoming")
    msg_rate_out: float = Field(default=0, description="Messages per second outgoing")
    msg_throughput_in: float = Field(default=0, description="Bytes per second incoming")
    msg_throughput_out: float = Field(
        default=0, description="Bytes per second outgoing"
    )


class ResourceInfo(BaseSchema):
    """Generic resource information."""

    id: UUID | None = None
    name: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
