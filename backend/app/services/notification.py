"""Notification service for managing alerts and warnings."""

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.events import event_bus
from app.models.notification import Notification, NotificationType, NotificationSeverity
from app.repositories.notification import NotificationRepository
from app.services.pulsar_admin import PulsarAdminService

logger = get_logger(__name__)

# Thresholds for alerts
CONSUMER_DISCONNECT_THRESHOLD = 0  # Alert when no consumers
STORAGE_WARNING_THRESHOLD_MB = 100  # Alert when storage > 100MB
STORAGE_CRITICAL_THRESHOLD_MB = 500  # Critical when storage > 500MB
BACKLOG_WARNING_THRESHOLD = 1000  # Alert when backlog > 1000 messages
BACKLOG_CRITICAL_THRESHOLD = 10000  # Critical when backlog > 10000 messages


class NotificationService:
    """Service for managing notifications and generating alerts."""

    def __init__(
        self,
        session: AsyncSession,
        pulsar_client: PulsarAdminService | None = None,
    ) -> None:
        self.session = session
        self.pulsar = pulsar_client
        self.repository = NotificationRepository(session)

    async def get_notifications(
        self,
        type: str | None = None,
        severity: str | None = None,
        is_read: bool | None = None,
        include_dismissed: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Notification]:
        """Get notifications with filtering."""
        return await self.repository.get_notifications(
            type=type,
            severity=severity,
            is_read=is_read,
            include_dismissed=include_dismissed,
            limit=limit,
            offset=offset,
        )

    async def get_notification(self, notification_id: UUID) -> Notification | None:
        """Get a specific notification."""
        return await self.repository.get_by_id(notification_id)

    async def get_unread_count(self) -> int:
        """Get count of unread notifications."""
        return await self.repository.get_unread_count()

    async def mark_as_read(self, notification_id: UUID) -> bool:
        """Mark a notification as read."""
        return await self.repository.mark_as_read(notification_id)

    async def mark_all_as_read(self) -> int:
        """Mark all notifications as read."""
        return await self.repository.mark_all_as_read()

    async def dismiss(self, notification_id: UUID) -> bool:
        """Dismiss a notification."""
        return await self.repository.dismiss(notification_id)

    async def dismiss_all(self) -> int:
        """Dismiss all notifications."""
        return await self.repository.dismiss_all()

    async def create_notification(
        self,
        type: NotificationType,
        severity: NotificationSeverity,
        title: str,
        message: str,
        resource_type: str | None = None,
        resource_id: str | None = None,
        extra_data: dict[str, Any] | None = None,
        dedupe_hours: int = 1,
    ) -> Notification | None:
        """Create a notification, with optional deduplication."""
        type_str = type.value if hasattr(type, 'value') else type
        severity_str = severity.value if hasattr(severity, 'value') else severity

        # Check for duplicate within dedupe window
        if dedupe_hours > 0:
            since = datetime.now(timezone.utc) - timedelta(hours=dedupe_hours)
            existing = await self.repository.find_existing(
                type=type_str,
                resource_type=resource_type,
                resource_id=resource_id,
                since=since,
            )
            if existing:
                logger.debug(
                    "Skipping duplicate notification",
                    type=type_str,
                    resource_id=resource_id,
                )
                return None

        notification = await self.repository.create_notification(
            type=type_str,
            severity=severity_str,
            title=title,
            message=message,
            resource_type=resource_type,
            resource_id=resource_id,
            extra_data=extra_data,
        )

        logger.info(
            "Notification created",
            type=type_str,
            severity=severity_str,
            title=title,
        )

        # Publish event
        await event_bus.publish("NOTIFICATIONS_UPDATED")

        return notification

    async def check_consumer_disconnects(
        self,
        subscriptions: list[dict[str, Any]],
    ) -> list[Notification]:
        """Check for subscriptions with no consumers."""
        notifications = []

        for sub in subscriptions:
            consumer_count = sub.get("consumer_count", 0)
            if consumer_count == CONSUMER_DISCONNECT_THRESHOLD:
                # Only alert for durable subscriptions
                if not sub.get("is_durable", True):
                    continue

                topic = sub.get("topic", "unknown")
                name = sub.get("name", "unknown")
                backlog = sub.get("msg_backlog", 0)

                # Determine severity based on backlog
                if backlog > BACKLOG_CRITICAL_THRESHOLD:
                    severity = NotificationSeverity.CRITICAL
                elif backlog > BACKLOG_WARNING_THRESHOLD:
                    severity = NotificationSeverity.WARNING
                else:
                    severity = NotificationSeverity.INFO

                notification = await self.create_notification(
                    type=NotificationType.CONSUMER_DISCONNECT,
                    severity=severity,
                    title=f"No consumers on {name}",
                    message=f"Subscription '{name}' on topic '{topic}' has no active consumers. "
                            f"Backlog: {backlog:,} messages.",
                    resource_type="subscription",
                    resource_id=f"{topic}/{name}",
                    extra_data={
                        "topic": topic,
                        "subscription": name,
                        "backlog": backlog,
                    },
                )
                if notification:
                    notifications.append(notification)

        return notifications

    async def check_broker_health(
        self,
        brokers: list[dict[str, Any]],
    ) -> list[Notification]:
        """Check broker health status."""
        notifications = []

        for broker in brokers:
            url = broker.get("url", "unknown")
            is_healthy = broker.get("is_healthy", True)
            cpu_usage = broker.get("cpu_usage", 0)
            memory_usage = broker.get("memory_usage", 0)

            # Check if broker is unhealthy
            if not is_healthy:
                notification = await self.create_notification(
                    type=NotificationType.BROKER_HEALTH,
                    severity=NotificationSeverity.CRITICAL,
                    title=f"Broker unhealthy: {url}",
                    message=f"Broker '{url}' is not responding or in unhealthy state.",
                    resource_type="broker",
                    resource_id=url,
                    extra_data={
                        "broker_url": url,
                        "is_healthy": is_healthy,
                    },
                )
                if notification:
                    notifications.append(notification)
                continue

            # Check high resource usage
            if cpu_usage > 90 or memory_usage > 90:
                severity = NotificationSeverity.CRITICAL
                title = f"High resource usage on {url}"
            elif cpu_usage > 75 or memory_usage > 75:
                severity = NotificationSeverity.WARNING
                title = f"Elevated resource usage on {url}"
            else:
                continue

            notification = await self.create_notification(
                type=NotificationType.BROKER_HEALTH,
                severity=severity,
                title=title,
                message=f"Broker '{url}' - CPU: {cpu_usage:.1f}%, Memory: {memory_usage:.1f}%",
                resource_type="broker",
                resource_id=url,
                extra_data={
                    "broker_url": url,
                    "cpu_usage": cpu_usage,
                    "memory_usage": memory_usage,
                },
            )
            if notification:
                notifications.append(notification)

        return notifications

    async def check_storage_warnings(
        self,
        topics: list[dict[str, Any]],
    ) -> list[Notification]:
        """Check for topics with high storage usage."""
        notifications = []

        for topic in topics:
            name = topic.get("name", "unknown")
            storage_bytes = topic.get("storage_size", 0)
            storage_mb = storage_bytes / (1024 * 1024)

            if storage_mb < STORAGE_WARNING_THRESHOLD_MB:
                continue

            if storage_mb >= STORAGE_CRITICAL_THRESHOLD_MB:
                severity = NotificationSeverity.CRITICAL
            else:
                severity = NotificationSeverity.WARNING

            notification = await self.create_notification(
                type=NotificationType.STORAGE_WARNING,
                severity=severity,
                title=f"High storage: {name}",
                message=f"Topic '{name}' is using {storage_mb:.1f} MB of storage.",
                resource_type="topic",
                resource_id=name,
                extra_data={
                    "topic": name,
                    "storage_mb": round(storage_mb, 2),
                    "storage_bytes": storage_bytes,
                },
            )
            if notification:
                notifications.append(notification)

        return notifications

    async def check_all_alerts(self) -> dict[str, int]:
        """Run all alert checks and return counts."""
        if not self.pulsar:
            logger.warning("No Pulsar client configured, skipping alert checks")
            return {}

        counts = {
            "consumer_disconnects": 0,
            "broker_health": 0,
            "storage_warnings": 0,
        }

        try:
            # This would need to be called from a scheduled task
            # with actual data from Pulsar
            pass
        except Exception as e:
            logger.error("Error checking alerts", error=str(e))

        return counts

    async def cleanup_old_notifications(self, days: int = 30) -> int:
        """Delete old notifications."""
        count = await self.repository.cleanup_old(days)
        logger.info("Cleaned up old notifications", count=count, days=days)
        return count
