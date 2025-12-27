"""Notification repository for notification data access."""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import and_, select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.repositories.base import BaseRepository


class NotificationRepository(BaseRepository[Notification]):
    """Repository for notification operations."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Notification, session)

    async def create_notification(
        self,
        type: str,
        severity: str,
        title: str,
        message: str,
        resource_type: str | None = None,
        resource_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> Notification:
        """Create a new notification."""
        return await self.create(
            type=type,
            severity=severity,
            title=title,
            message=message,
            resource_type=resource_type,
            resource_id=resource_id,
            metadata=metadata,
            is_read=False,
            is_dismissed=False,
        )

    async def get_notifications(
        self,
        type: str | None = None,
        severity: str | None = None,
        is_read: bool | None = None,
        include_dismissed: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Notification]:
        """Get notifications with filters."""
        conditions = []

        if not include_dismissed:
            conditions.append(Notification.is_dismissed == False)
        if type:
            conditions.append(Notification.type == type)
        if severity:
            conditions.append(Notification.severity == severity)
        if is_read is not None:
            conditions.append(Notification.is_read == is_read)

        query = (
            select(Notification)
            .where(and_(*conditions) if conditions else True)
            .order_by(Notification.created_at.desc())
            .offset(offset)
            .limit(limit)
        )

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_unread_count(self) -> int:
        """Get count of unread, non-dismissed notifications."""
        query = (
            select(func.count())
            .select_from(Notification)
            .where(
                and_(
                    Notification.is_read == False,
                    Notification.is_dismissed == False,
                )
            )
        )
        result = await self.session.execute(query)
        return result.scalar_one()

    async def mark_as_read(self, notification_id: UUID) -> bool:
        """Mark a notification as read."""
        result = await self.session.execute(
            update(Notification)
            .where(Notification.id == notification_id)
            .values(is_read=True)
        )
        return result.rowcount > 0

    async def mark_all_as_read(self) -> int:
        """Mark all notifications as read."""
        result = await self.session.execute(
            update(Notification)
            .where(Notification.is_read == False)
            .values(is_read=True)
        )
        return result.rowcount

    async def dismiss(self, notification_id: UUID) -> bool:
        """Dismiss a notification."""
        result = await self.session.execute(
            update(Notification)
            .where(Notification.id == notification_id)
            .values(is_dismissed=True)
        )
        return result.rowcount > 0

    async def dismiss_all(self) -> int:
        """Dismiss all notifications."""
        result = await self.session.execute(
            update(Notification)
            .where(Notification.is_dismissed == False)
            .values(is_dismissed=True)
        )
        return result.rowcount

    async def find_existing(
        self,
        type: str,
        resource_type: str | None,
        resource_id: str | None,
        since: datetime | None = None,
    ) -> Notification | None:
        """Find existing notification to avoid duplicates."""
        conditions = [
            Notification.type == type,
            Notification.is_dismissed == False,
        ]

        if resource_type:
            conditions.append(Notification.resource_type == resource_type)
        if resource_id:
            conditions.append(Notification.resource_id == resource_id)
        if since:
            conditions.append(Notification.created_at >= since)

        query = (
            select(Notification)
            .where(and_(*conditions))
            .order_by(Notification.created_at.desc())
            .limit(1)
        )

        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def cleanup_old(self, days: int = 30) -> int:
        """Delete notifications older than specified days."""
        from datetime import timedelta
        cutoff = datetime.now() - timedelta(days=days)

        from sqlalchemy import delete
        result = await self.session.execute(
            delete(Notification).where(Notification.created_at < cutoff)
        )
        return result.rowcount
