"""Notification schemas."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class NotificationResponse(BaseModel):
    """Response model for a notification."""

    id: UUID
    type: str
    severity: str
    title: str
    message: str
    resource_type: str | None = None
    resource_id: str | None = None
    metadata: dict[str, Any] | None = None
    is_read: bool
    is_dismissed: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class NotificationListResponse(BaseModel):
    """Response model for list of notifications."""

    notifications: list[NotificationResponse]
    total: int
    unread_count: int


class NotificationCountResponse(BaseModel):
    """Response model for notification counts."""

    unread_count: int


class MarkReadRequest(BaseModel):
    """Request to mark notification(s) as read."""

    notification_ids: list[UUID] | None = Field(
        default=None,
        description="IDs to mark as read. If empty, marks all as read.",
    )


class DismissRequest(BaseModel):
    """Request to dismiss notification(s)."""

    notification_ids: list[UUID] | None = Field(
        default=None,
        description="IDs to dismiss. If empty, dismisses all.",
    )


class CreateNotificationRequest(BaseModel):
    """Request to manually create a notification (for testing)."""

    type: str = Field(description="Notification type")
    severity: str = Field(default="info", description="Severity level")
    title: str = Field(description="Notification title")
    message: str = Field(description="Notification message")
    resource_type: str | None = None
    resource_id: str | None = None
    metadata: dict[str, Any] | None = None
