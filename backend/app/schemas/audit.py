"""Audit event schemas."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import Field

from app.schemas.common import BaseSchema


class AuditEventResponse(BaseSchema):
    """Audit event response schema."""

    id: UUID
    action: str
    resource_type: str
    resource_id: str
    user_id: str | None = None
    user_email: str | None = None
    details: dict[str, Any] | None = None
    ip_address: str | None = None
    user_agent: str | None = None
    timestamp: datetime


class AuditEventListResponse(BaseSchema):
    """Response for audit event list."""

    events: list[AuditEventResponse]
    total: int


class AuditEventCountsResponse(BaseSchema):
    """Response for audit event counts."""

    counts: dict[str, int]


class AuditQueryParams(BaseSchema):
    """Query parameters for audit events."""

    action: str | None = Field(default=None, description="Filter by action type")
    resource_type: str | None = Field(
        default=None, description="Filter by resource type"
    )
    resource_id: str | None = Field(default=None, description="Filter by resource ID")
    user_id: str | None = Field(default=None, description="Filter by user ID")
    start_time: datetime | None = Field(default=None, description="Start time filter")
    end_time: datetime | None = Field(default=None, description="End time filter")
    limit: int = Field(default=100, ge=1, le=1000, description="Max results")
    offset: int = Field(default=0, ge=0, description="Offset for pagination")
