"""Subscription API routes."""

from fastapi import APIRouter, Query, status

from app.api.deps import AuditSvc, RequestInfo, SubscriptionSvc
from app.models.audit import ResourceType
from app.schemas import (
    ExpireMessagesRequest,
    ResetCursorRequest,
    ResetCursorToMessageIdRequest,
    SkipMessagesRequest,
    SubscriptionCreate,
    SubscriptionDetailResponse,
    SubscriptionListResponse,
    SubscriptionResponse,
    SuccessResponse,
)

router = APIRouter(
    prefix="/tenants/{tenant}/namespaces/{namespace}/topics/{topic}/subscriptions",
    tags=["Subscriptions"],
)


@router.get("", response_model=SubscriptionListResponse)
async def list_subscriptions(
    tenant: str,
    namespace: str,
    topic: str,
    service: SubscriptionSvc,
    persistent: bool = Query(default=True, description="Persistent topic"),
    use_cache: bool = Query(default=True, description="Use cached data"),
) -> SubscriptionListResponse:
    """List all subscriptions for a topic."""
    subscriptions = await service.get_subscriptions(
        tenant, namespace, topic, persistent=persistent, use_cache=use_cache
    )
    return SubscriptionListResponse(
        subscriptions=[SubscriptionResponse(**s) for s in subscriptions],
        total=len(subscriptions),
    )


@router.get("/{subscription}", response_model=SubscriptionDetailResponse)
async def get_subscription(
    tenant: str,
    namespace: str,
    topic: str,
    subscription: str,
    service: SubscriptionSvc,
    persistent: bool = Query(default=True, description="Persistent topic"),
) -> SubscriptionDetailResponse:
    """Get subscription details."""
    data = await service.get_subscription(
        tenant, namespace, topic, subscription, persistent=persistent
    )
    return SubscriptionDetailResponse(**data)


@router.post("", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_subscription(
    tenant: str,
    namespace: str,
    topic: str,
    data: SubscriptionCreate,
    service: SubscriptionSvc,
    audit: AuditSvc,
    request_info: RequestInfo,
    persistent: bool = Query(default=True, description="Persistent topic"),
) -> SubscriptionResponse:
    """Create a new subscription."""
    result = await service.create_subscription(
        tenant=tenant,
        namespace=namespace,
        topic=topic,
        subscription=data.name,
        persistent=persistent,
        message_id=data.message_id,
    )

    # Log audit event
    persistence = "persistent" if persistent else "non-persistent"
    await audit.log_create(
        resource_type=ResourceType.SUBSCRIPTION,
        resource_id=f"{persistence}://{tenant}/{namespace}/{topic}/{data.name}",
        details={"message_id": data.message_id},
        **request_info,
    )

    return SubscriptionResponse(**result)


@router.delete("/{subscription}", response_model=SuccessResponse)
async def delete_subscription(
    tenant: str,
    namespace: str,
    topic: str,
    subscription: str,
    service: SubscriptionSvc,
    audit: AuditSvc,
    request_info: RequestInfo,
    persistent: bool = Query(default=True, description="Persistent topic"),
    force: bool = Query(default=False, description="Force delete"),
) -> SuccessResponse:
    """Delete a subscription."""
    await service.delete_subscription(
        tenant, namespace, topic, subscription, persistent=persistent, force=force
    )

    # Log audit event
    persistence = "persistent" if persistent else "non-persistent"
    await audit.log_delete(
        resource_type=ResourceType.SUBSCRIPTION,
        resource_id=f"{persistence}://{tenant}/{namespace}/{topic}/{subscription}",
        details={"force": force},
        **request_info,
    )

    return SuccessResponse(message=f"Subscription '{subscription}' deleted")


@router.post("/{subscription}/skip", response_model=SuccessResponse)
async def skip_messages(
    tenant: str,
    namespace: str,
    topic: str,
    subscription: str,
    data: SkipMessagesRequest,
    service: SubscriptionSvc,
    persistent: bool = Query(default=True, description="Persistent topic"),
) -> SuccessResponse:
    """Skip messages in a subscription."""
    await service.skip_messages(
        tenant, namespace, topic, subscription, data.count, persistent=persistent
    )
    return SuccessResponse(message=f"Skipped {data.count} messages")


@router.post("/{subscription}/skip-all", response_model=SuccessResponse)
async def skip_all_messages(
    tenant: str,
    namespace: str,
    topic: str,
    subscription: str,
    service: SubscriptionSvc,
    persistent: bool = Query(default=True, description="Persistent topic"),
) -> SuccessResponse:
    """Skip all messages in a subscription (clear backlog)."""
    await service.skip_all_messages(
        tenant, namespace, topic, subscription, persistent=persistent
    )
    return SuccessResponse(message="All messages skipped")


@router.post("/{subscription}/reset-cursor", response_model=SuccessResponse)
async def reset_cursor(
    tenant: str,
    namespace: str,
    topic: str,
    subscription: str,
    data: ResetCursorRequest,
    service: SubscriptionSvc,
    persistent: bool = Query(default=True, description="Persistent topic"),
) -> SuccessResponse:
    """Reset subscription cursor to a timestamp."""
    await service.reset_cursor(
        tenant, namespace, topic, subscription, data.timestamp, persistent=persistent
    )
    return SuccessResponse(message=f"Cursor reset to timestamp {data.timestamp}")


@router.post("/{subscription}/reset-cursor-to-message", response_model=SuccessResponse)
async def reset_cursor_to_message_id(
    tenant: str,
    namespace: str,
    topic: str,
    subscription: str,
    data: ResetCursorToMessageIdRequest,
    service: SubscriptionSvc,
    persistent: bool = Query(default=True, description="Persistent topic"),
) -> SuccessResponse:
    """Reset subscription cursor to a message ID."""
    await service.reset_cursor_to_message_id(
        tenant, namespace, topic, subscription, data.message_id, persistent=persistent
    )
    return SuccessResponse(message=f"Cursor reset to message {data.message_id}")


@router.post("/{subscription}/expire", response_model=SuccessResponse)
async def expire_messages(
    tenant: str,
    namespace: str,
    topic: str,
    subscription: str,
    data: ExpireMessagesRequest,
    service: SubscriptionSvc,
    persistent: bool = Query(default=True, description="Persistent topic"),
) -> SuccessResponse:
    """Expire messages older than given time."""
    await service.expire_messages(
        tenant,
        namespace,
        topic,
        subscription,
        data.expire_time_seconds,
        persistent=persistent,
    )
    return SuccessResponse(
        message=f"Messages older than {data.expire_time_seconds}s expired"
    )
