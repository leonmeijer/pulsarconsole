"""Audit repository for audit event data access."""

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import and_, select, func
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
        """Query audit events with filters."""
        conditions = []

        if start_time:
            conditions.append(AuditEvent.timestamp >= start_time)
        if end_time:
            conditions.append(AuditEvent.timestamp <= end_time)
        if resource_type:
            conditions.append(AuditEvent.resource_type == resource_type)
        if action:
            conditions.append(AuditEvent.action == action)
        if resource_id:
            conditions.append(AuditEvent.resource_id == resource_id)

        query = (
            select(AuditEvent)
            .where(and_(*conditions) if conditions else True)
            .order_by(AuditEvent.timestamp.desc())
            .offset(skip)
            .limit(limit)
        )

        result = await self.session.execute(query)
        return list(result.scalars().all())

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
