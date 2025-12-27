"""Audit API routes."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import AuditSvc
from app.models.audit import ActionType, ResourceType
from app.schemas import (
    AuditEventCountsResponse,
    AuditEventListResponse,
    AuditEventResponse,
)

router = APIRouter(prefix="/audit", tags=["Audit"])


@router.get("/events", response_model=AuditEventListResponse)
async def list_audit_events(
    service: AuditSvc,
    action: str | None = Query(default=None, description="Filter by action type"),
    resource_type: str | None = Query(default=None, description="Filter by resource type"),
    resource_id: str | None = Query(default=None, description="Filter by resource ID"),
    user_id: str | None = Query(default=None, description="Filter by user ID"),
    start_time: datetime | None = Query(default=None, description="Start time filter"),
    end_time: datetime | None = Query(default=None, description="End time filter"),
    limit: int = Query(default=100, ge=1, le=1000, description="Max results"),
    offset: int = Query(default=0, ge=0, description="Offset for pagination"),
) -> AuditEventListResponse:
    """List audit events with filtering."""
    action_type = ActionType(action) if action else None
    res_type = ResourceType(resource_type) if resource_type else None

    events = await service.get_events(
        action=action_type,
        resource_type=res_type,
        resource_id=resource_id,
        user_id=user_id,
        start_time=start_time,
        end_time=end_time,
        limit=limit,
        offset=offset,
    )

    return AuditEventListResponse(
        events=[
            AuditEventResponse(
                id=e.id,
                action=e.action.value,
                resource_type=e.resource_type.value,
                resource_id=e.resource_id,
                user_id=e.user_id,
                user_email=e.user_email,
                details=e.details,
                ip_address=e.ip_address,
                user_agent=e.user_agent,
                timestamp=e.timestamp,
            )
            for e in events
        ],
        total=len(events),
    )


@router.get("/events/{event_id}", response_model=AuditEventResponse | None)
async def get_audit_event(event_id: UUID, service: AuditSvc) -> AuditEventResponse | None:
    """Get a specific audit event."""
    event = await service.get_event(event_id)
    if event is None:
        return None

    return AuditEventResponse(
        id=event.id,
        action=event.action.value,
        resource_type=event.resource_type.value,
        resource_id=event.resource_id,
        user_id=event.user_id,
        user_email=event.user_email,
        details=event.details,
        ip_address=event.ip_address,
        user_agent=event.user_agent,
        timestamp=event.timestamp,
    )


@router.get("/events/resource/{resource_type}/{resource_id:path}")
async def get_resource_history(
    resource_type: str,
    resource_id: str,
    service: AuditSvc,
    limit: int = Query(default=50, ge=1, le=500),
) -> AuditEventListResponse:
    """Get audit history for a specific resource."""
    res_type = ResourceType(resource_type)
    events = await service.get_resource_history(res_type, resource_id, limit=limit)

    return AuditEventListResponse(
        events=[
            AuditEventResponse(
                id=e.id,
                action=e.action.value,
                resource_type=e.resource_type.value,
                resource_id=e.resource_id,
                user_id=e.user_id,
                user_email=e.user_email,
                details=e.details,
                ip_address=e.ip_address,
                user_agent=e.user_agent,
                timestamp=e.timestamp,
            )
            for e in events
        ],
        total=len(events),
    )


@router.get("/counts/by-action", response_model=AuditEventCountsResponse)
async def get_counts_by_action(
    service: AuditSvc,
    start_time: datetime | None = Query(default=None),
    end_time: datetime | None = Query(default=None),
) -> AuditEventCountsResponse:
    """Get event counts grouped by action type."""
    counts = await service.get_event_counts_by_action(start_time, end_time)
    return AuditEventCountsResponse(counts=counts)


@router.get("/counts/by-resource", response_model=AuditEventCountsResponse)
async def get_counts_by_resource(
    service: AuditSvc,
    start_time: datetime | None = Query(default=None),
    end_time: datetime | None = Query(default=None),
) -> AuditEventCountsResponse:
    """Get event counts grouped by resource type."""
    counts = await service.get_event_counts_by_resource(start_time, end_time)
    return AuditEventCountsResponse(counts=counts)
