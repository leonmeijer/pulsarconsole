"""Notification API routes."""

from uuid import UUID

from fastapi import APIRouter, Query, status

from app.api.deps import NotificationSvc
from app.models.notification import NotificationType, NotificationSeverity
from app.schemas import (
    CreateNotificationRequest,
    NotificationCountResponse,
    NotificationListResponse,
    NotificationResponse,
    SuccessResponse,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    service: NotificationSvc,
    type: str | None = Query(default=None, description="Filter by type"),
    severity: str | None = Query(default=None, description="Filter by severity"),
    is_read: bool | None = Query(default=None, description="Filter by read status"),
    include_dismissed: bool = Query(default=False, description="Include dismissed"),
    limit: int = Query(default=50, ge=1, le=200, description="Max results"),
    offset: int = Query(default=0, ge=0, description="Offset"),
) -> NotificationListResponse:
    """Get notifications with filtering."""
    notifications = await service.get_notifications(
        type=type,
        severity=severity,
        is_read=is_read,
        include_dismissed=include_dismissed,
        limit=limit,
        offset=offset,
    )

    unread_count = await service.get_unread_count()

    return NotificationListResponse(
        notifications=[
            NotificationResponse(
                id=n.id,
                type=n.type,
                severity=n.severity,
                title=n.title,
                message=n.message,
                resource_type=n.resource_type,
                resource_id=n.resource_id,
                metadata=n.extra_data,
                is_read=n.is_read,
                is_dismissed=n.is_dismissed,
                created_at=n.created_at,
            )
            for n in notifications
        ],
        total=len(notifications),
        unread_count=unread_count,
    )


@router.get("/count", response_model=NotificationCountResponse)
async def get_unread_count(service: NotificationSvc) -> NotificationCountResponse:
    """Get count of unread notifications."""
    count = await service.get_unread_count()
    return NotificationCountResponse(unread_count=count)


@router.get("/{notification_id}", response_model=NotificationResponse | None)
async def get_notification(
    notification_id: UUID,
    service: NotificationSvc,
) -> NotificationResponse | None:
    """Get a specific notification."""
    n = await service.get_notification(notification_id)
    if n is None:
        return None

    return NotificationResponse(
        id=n.id,
        type=n.type,
        severity=n.severity,
        title=n.title,
        message=n.message,
        resource_type=n.resource_type,
        resource_id=n.resource_id,
        metadata=n.metadata,
        is_read=n.is_read,
        is_dismissed=n.is_dismissed,
        created_at=n.created_at,
    )


@router.post("/{notification_id}/read", response_model=SuccessResponse)
async def mark_as_read(
    notification_id: UUID,
    service: NotificationSvc,
) -> SuccessResponse:
    """Mark a notification as read."""
    success = await service.mark_as_read(notification_id)
    if success:
        return SuccessResponse(message="Notification marked as read")
    return SuccessResponse(message="Notification not found")


@router.post("/read-all", response_model=SuccessResponse)
async def mark_all_as_read(service: NotificationSvc) -> SuccessResponse:
    """Mark all notifications as read."""
    count = await service.mark_all_as_read()
    return SuccessResponse(message=f"Marked {count} notifications as read")


@router.post("/{notification_id}/dismiss", response_model=SuccessResponse)
async def dismiss_notification(
    notification_id: UUID,
    service: NotificationSvc,
) -> SuccessResponse:
    """Dismiss a notification."""
    success = await service.dismiss(notification_id)
    if success:
        return SuccessResponse(message="Notification dismissed")
    return SuccessResponse(message="Notification not found")


@router.post("/dismiss-all", response_model=SuccessResponse)
async def dismiss_all_notifications(service: NotificationSvc) -> SuccessResponse:
    """Dismiss all notifications."""
    count = await service.dismiss_all()
    return SuccessResponse(message=f"Dismissed {count} notifications")


@router.post("", response_model=NotificationResponse, status_code=status.HTTP_201_CREATED)
async def create_notification(
    data: CreateNotificationRequest,
    service: NotificationSvc,
) -> NotificationResponse:
    """Create a notification (for testing/manual alerts)."""
    try:
        notification_type = NotificationType(data.type)
    except ValueError:
        notification_type = NotificationType.INFO

    try:
        notification_severity = NotificationSeverity(data.severity)
    except ValueError:
        notification_severity = NotificationSeverity.INFO

    n = await service.create_notification(
        type=notification_type,
        severity=notification_severity,
        title=data.title,
        message=data.message,
        resource_type=data.resource_type,
        resource_id=data.resource_id,
        extra_data=data.metadata,
        dedupe_hours=0,  # No deduplication for manual creation
    )

    return NotificationResponse(
        id=n.id,
        type=n.type,
        severity=n.severity,
        title=n.title,
        message=n.message,
        resource_type=n.resource_type,
        resource_id=n.resource_id,
        metadata=n.extra_data,
        is_read=n.is_read,
        is_dismissed=n.is_dismissed,
        created_at=n.created_at,
    )


@router.post("/check-alerts", response_model=SuccessResponse)
async def trigger_alert_check() -> SuccessResponse:
    """Manually trigger alert checks."""
    from app.worker.tasks.alerts import (
        _check_consumer_disconnects,
        _check_broker_health,
        _check_storage_warnings,
    )

    consumer_count = await _check_consumer_disconnects()
    broker_count = await _check_broker_health()
    storage_count = await _check_storage_warnings()
    total = consumer_count + broker_count + storage_count

    return SuccessResponse(
        message=f"Alert check complete. Generated {total} new alerts. "
        f"(disconnects: {consumer_count}, broker: {broker_count}, storage: {storage_count})"
    )
