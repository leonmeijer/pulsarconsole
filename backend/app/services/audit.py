"""Audit service for tracking user actions."""

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.audit import ActionType, AuditEvent, ResourceType
from app.repositories.audit import AuditRepository

logger = get_logger(__name__)


class AuditService:
    """Service for tracking and querying audit events."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repository = AuditRepository(session)

    async def log_event(
        self,
        action: ActionType,
        resource_type: ResourceType,
        resource_id: str,
        user_id: str | None = None,
        user_email: str | None = None,
        details: dict[str, Any] | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
        status: str = "success",
    ) -> AuditEvent:
        """Log an audit event."""
        # 1. Database Storage
        # Build request_params including user info and details
        request_params: dict[str, Any] = {}
        if details:
            request_params.update(details)
        if user_id:
            request_params["user_id"] = user_id
        if user_email:
            request_params["user_email"] = user_email
        if ip_address:
            request_params["ip_address"] = ip_address
        if user_agent:
            request_params["user_agent"] = user_agent

        event = await self.repository.create(
            action=action.value if isinstance(action, ActionType) else action,
            resource_type=resource_type.value if isinstance(resource_type, ResourceType) else resource_type,
            resource_id=resource_id,
            request_params=request_params if request_params else None,
            status=status,
        )

        # 2. Structured JSON Logging (for Elastic/Filebeat)
        # Using ECS (Elastic Common Schema) inspired fields
        action_val = action.value if isinstance(action, ActionType) else action
        res_type_val = resource_type.value if isinstance(resource_type, ResourceType) else resource_type
        
        logger.info(
            "audit_event",
            event_action=action_val,
            event_provider="pulsar_console",
            event_dataset="audit",
            resource_type=res_type_val,
            resource_id=resource_id,
            user_email=user_email,
            user_id=user_id,
            status=status,
            client_ip=ip_address,
            user_agent=user_agent,
            details=details,
        )

        return event

    async def log_create(
        self,
        resource_type: ResourceType,
        resource_id: str,
        user_id: str | None = None,
        user_email: str | None = None,
        details: dict[str, Any] | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> AuditEvent:
        """Log a resource creation event."""
        return await self.log_event(
            action=ActionType.CREATE,
            resource_type=resource_type,
            resource_id=resource_id,
            user_id=user_id,
            user_email=user_email,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    async def log_update(
        self,
        resource_type: ResourceType,
        resource_id: str,
        user_id: str | None = None,
        user_email: str | None = None,
        details: dict[str, Any] | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> AuditEvent:
        """Log a resource update event."""
        return await self.log_event(
            action=ActionType.UPDATE,
            resource_type=resource_type,
            resource_id=resource_id,
            user_id=user_id,
            user_email=user_email,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    async def log_delete(
        self,
        resource_type: ResourceType,
        resource_id: str,
        user_id: str | None = None,
        user_email: str | None = None,
        details: dict[str, Any] | None = None,
        ip_address: str | None = None,
        user_agent: str | None = None,
    ) -> AuditEvent:
        """Log a resource deletion event."""
        return await self.log_event(
            action=ActionType.DELETE,
            resource_type=resource_type,
            resource_id=resource_id,
            user_id=user_id,
            user_email=user_email,
            details=details,
            ip_address=ip_address,
            user_agent=user_agent,
        )

    async def get_events(
        self,
        action: ActionType | None = None,
        resource_type: ResourceType | None = None,
        resource_id: str | None = None,
        user_id: str | None = None,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AuditEvent]:
        """Get audit events with filtering."""
        return await self.repository.get_events(
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            user_id=user_id,
            start_time=start_time,
            end_time=end_time,
            limit=limit,
            offset=offset,
        )

    async def get_event(self, event_id: UUID) -> AuditEvent | None:
        """Get a specific audit event by ID."""
        return await self.repository.get_by_id(event_id)

    async def get_resource_history(
        self,
        resource_type: ResourceType,
        resource_id: str,
        limit: int = 50,
    ) -> list[AuditEvent]:
        """Get audit history for a specific resource."""
        return await self.repository.get_events(
            resource_type=resource_type,
            resource_id=resource_id,
            limit=limit,
        )

    async def get_user_activity(
        self,
        user_id: str,
        limit: int = 50,
    ) -> list[AuditEvent]:
        """Get audit events for a specific user."""
        return await self.repository.get_events(
            user_id=user_id,
            limit=limit,
        )

    async def get_recent_events(
        self,
        limit: int = 20,
    ) -> list[AuditEvent]:
        """Get the most recent audit events."""
        return await self.repository.get_events(limit=limit)

    async def cleanup_old_events(
        self,
        days: int = 90,
    ) -> int:
        """Delete audit events older than specified days."""
        cutoff = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        from datetime import timedelta
        cutoff = cutoff - timedelta(days=days)

        count = await self.repository.delete_before(cutoff)

        logger.info(
            "Cleaned up old audit events",
            days=days,
            deleted_count=count,
        )

        return count

    async def get_event_counts_by_action(
        self,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> dict[str, int]:
        """Get event counts grouped by action type."""
        return await self.repository.count_by_action(start_time, end_time)

    async def get_event_counts_by_resource(
        self,
        start_time: datetime | None = None,
        end_time: datetime | None = None,
    ) -> dict[str, int]:
        """Get event counts grouped by resource type."""
        return await self.repository.count_by_resource(start_time, end_time)
