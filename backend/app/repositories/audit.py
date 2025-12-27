"""Audit repository for audit event data access."""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import and_, delete, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit import AuditEvent
from app.repositories.base import BaseRepository


class AuditRepository(BaseRepository[AuditEvent]):
    """Repository for audit event operations."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AuditEvent, session)

    async def create_event(
        self,
        action: str,
        resource_type: str,
        resource_id: str,
        status: str,
        request_params: dict[str, Any] | None = None,
        error_message: str | None = None,
    ) -> AuditEvent:
        """Create a new audit event."""
        return await self.create(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            status=status,
            request_params=request_params,
            error_message=error_message,
        )

    async def get_events(
        self,
        action: Any | None = None,
        resource_type: Any | None = None,
        resource_id: str | None = None,
        user_id: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AuditEvent]:
        """Get audit events with filters."""
        conditions = []

        if start_time:
            conditions.append(AuditEvent.timestamp >= start_time)
        if end_time:
            conditions.append(AuditEvent.timestamp <= end_time)
        if resource_type:
            rt_value = resource_type.value if hasattr(resource_type, 'value') else resource_type
            conditions.append(AuditEvent.resource_type == rt_value)
        if action:
            action_value = action.value if hasattr(action, 'value') else action
            conditions.append(AuditEvent.action == action_value)
        if resource_id:
            conditions.append(AuditEvent.resource_id == resource_id)
        # user_id is stored in request_params JSON, skip filtering for now

        query = (
            select(AuditEvent)
            .where(and_(*conditions) if conditions else True)
            .order_by(AuditEvent.timestamp.desc())
            .offset(offset)
            .limit(limit)
        )

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def query_events(
        self,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        resource_type: str | None = None,
        action: str | None = None,
        resource_id: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[AuditEvent]:
        """Query audit events with filters (legacy method)."""
        return await self.get_events(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            start_time=start_time,
            end_time=end_time,
            limit=limit,
            offset=skip,
        )

    async def count_events(
        self,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        resource_type: str | None = None,
        action: str | None = None,
    ) -> int:
        """Count audit events with filters."""
        conditions = []

        if start_time:
            conditions.append(AuditEvent.timestamp >= start_time)
        if end_time:
            conditions.append(AuditEvent.timestamp <= end_time)
        if resource_type:
            conditions.append(AuditEvent.resource_type == resource_type)
        if action:
            conditions.append(AuditEvent.action == action)

        query = (
            select(func.count())
            .select_from(AuditEvent)
            .where(and_(*conditions) if conditions else True)
        )

        result = await self.session.execute(query)
        return result.scalar_one()

    async def get_recent_by_resource(
        self,
        resource_type: str,
        resource_id: str,
        limit: int = 10,
    ) -> list[AuditEvent]:
        """Get recent audit events for a specific resource."""
        query = (
            select(AuditEvent)
            .where(
                and_(
                    AuditEvent.resource_type == resource_type,
                    AuditEvent.resource_id == resource_id,
                )
            )
            .order_by(AuditEvent.timestamp.desc())
            .limit(limit)
        )

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def count_by_action(
        self,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> dict[str, int]:
        """Get event counts grouped by action type."""
        conditions = []
        if start_time:
            conditions.append(AuditEvent.timestamp >= start_time)
        if end_time:
            conditions.append(AuditEvent.timestamp <= end_time)

        query = (
            select(AuditEvent.action, func.count())
            .where(and_(*conditions) if conditions else True)
            .group_by(AuditEvent.action)
        )

        result = await self.session.execute(query)
        return {row[0]: row[1] for row in result.all()}

    async def count_by_resource(
        self,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> dict[str, int]:
        """Get event counts grouped by resource type."""
        conditions = []
        if start_time:
            conditions.append(AuditEvent.timestamp >= start_time)
        if end_time:
            conditions.append(AuditEvent.timestamp <= end_time)

        query = (
            select(AuditEvent.resource_type, func.count())
            .where(and_(*conditions) if conditions else True)
            .group_by(AuditEvent.resource_type)
        )

        result = await self.session.execute(query)
        return {row[0]: row[1] for row in result.all()}

    async def delete_before(self, cutoff: datetime) -> int:
        """Delete audit events before the cutoff date."""
        result = await self.session.execute(
            delete(AuditEvent).where(AuditEvent.timestamp < cutoff)
        )
        return result.rowcount
