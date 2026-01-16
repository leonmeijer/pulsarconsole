"""Topic API routes."""

from fastapi import APIRouter, Query, status

from app.api.deps import AuditSvc, CurrentApprovedUser, RequestInfo, TopicSvc
from app.models.audit import ResourceType
from app.schemas import (
    SuccessResponse,
    TopicCreate,
    TopicDetailResponse,
    TopicListResponse,
    TopicPartitionUpdate,
    TopicResponse,
)

router = APIRouter(
    prefix="/tenants/{tenant}/namespaces/{namespace}/topics",
    tags=["Topics"],
)


@router.get("", response_model=TopicListResponse)
async def list_topics(
    tenant: str,
    namespace: str,
    _user: CurrentApprovedUser,
    service: TopicSvc,
    persistent: bool = Query(default=True, description="List persistent topics"),
    use_cache: bool = Query(default=True, description="Use cached data"),
) -> TopicListResponse:
    """List all topics in a namespace."""
    topics = await service.get_topics(
        tenant, namespace, persistent=persistent, use_cache=use_cache
    )
    return TopicListResponse(
        topics=[TopicResponse(**t) for t in topics],
        total=len(topics),
    )


@router.get("/{topic}", response_model=TopicDetailResponse)
async def get_topic(
    tenant: str,
    namespace: str,
    topic: str,
    _user: CurrentApprovedUser,
    service: TopicSvc,
    persistent: bool = Query(default=True, description="Persistent topic"),
) -> TopicDetailResponse:
    """Get topic details."""
    data = await service.get_topic(tenant, namespace, topic, persistent=persistent)
    return TopicDetailResponse(**data)


@router.post("", response_model=TopicResponse, status_code=status.HTTP_201_CREATED)
async def create_topic(
    tenant: str,
    namespace: str,
    data: TopicCreate,
    _user: CurrentApprovedUser,
    service: TopicSvc,
    audit: AuditSvc,
    request_info: RequestInfo,
) -> TopicResponse:
    """Create a new topic."""
    result = await service.create_topic(
        tenant=tenant,
        namespace=namespace,
        topic=data.name,
        persistent=data.persistent,
        partitions=data.partitions,
    )

    # Log audit event
    persistence = "persistent" if data.persistent else "non-persistent"
    await audit.log_create(
        resource_type=ResourceType.TOPIC,
        resource_id=f"{persistence}://{tenant}/{namespace}/{data.name}",
        details={"partitions": data.partitions},
        **request_info,
    )

    return TopicResponse(**result)


@router.delete("/{topic}", response_model=SuccessResponse)
async def delete_topic(
    tenant: str,
    namespace: str,
    topic: str,
    _user: CurrentApprovedUser,
    service: TopicSvc,
    audit: AuditSvc,
    request_info: RequestInfo,
    persistent: bool = Query(default=True, description="Persistent topic"),
    force: bool = Query(default=False, description="Force delete"),
) -> SuccessResponse:
    """Delete a topic."""
    await service.delete_topic(
        tenant, namespace, topic, persistent=persistent, force=force
    )

    # Log audit event
    persistence = "persistent" if persistent else "non-persistent"
    await audit.log_delete(
        resource_type=ResourceType.TOPIC,
        resource_id=f"{persistence}://{tenant}/{namespace}/{topic}",
        details={"force": force},
        **request_info,
    )

    persistence = "persistent" if persistent else "non-persistent"
    return SuccessResponse(
        message=f"Topic '{persistence}://{tenant}/{namespace}/{topic}' deleted"
    )


@router.get("/{topic}/partitions", response_model=dict)
async def get_topic_partitions(
    tenant: str,
    namespace: str,
    topic: str,
    _user: CurrentApprovedUser,
    service: TopicSvc,
    persistent: bool = Query(default=True, description="Persistent topic"),
) -> dict:
    """Get the number of partitions for a topic."""
    partitions = await service.get_partitions(
        tenant, namespace, topic, persistent=persistent
    )
    return {"topic": topic, "partitions": partitions}


@router.put("/{topic}/partitions", response_model=TopicResponse)
async def update_topic_partitions(
    tenant: str,
    namespace: str,
    topic: str,
    data: TopicPartitionUpdate,
    _user: CurrentApprovedUser,
    service: TopicSvc,
    audit: AuditSvc,
    request_info: RequestInfo,
    persistent: bool = Query(default=True, description="Persistent topic"),
) -> TopicResponse:
    """Update the number of partitions for a partitioned topic."""
    result = await service.update_partitions(
        tenant, namespace, topic, data.partitions, persistent=persistent
    )

    # Log audit event
    persistence = "persistent" if persistent else "non-persistent"
    await audit.log_update(
        resource_type=ResourceType.TOPIC,
        resource_id=f"{persistence}://{tenant}/{namespace}/{topic}",
        details={"partitions": data.partitions},
        **request_info,
    )

    return TopicResponse(**result)


@router.post("/{topic}/unload", response_model=SuccessResponse)
async def unload_topic(
    tenant: str,
    namespace: str,
    topic: str,
    _user: CurrentApprovedUser,
    service: TopicSvc,
    audit: AuditSvc,
    request_info: RequestInfo,
    persistent: bool = Query(default=True, description="Persistent topic"),
) -> SuccessResponse:
    """Unload a topic from the broker."""
    await service.unload_topic(tenant, namespace, topic, persistent=persistent)

    # Log audit event
    persistence = "persistent" if persistent else "non-persistent"
    await audit.log_event(
        action="unload",
        resource_type=ResourceType.TOPIC,
        resource_id=f"{persistence}://{tenant}/{namespace}/{topic}",
        **request_info,
    )

    return SuccessResponse(message=f"Topic '{topic}' unloaded")


@router.post("/{topic}/compact", response_model=SuccessResponse)
async def compact_topic(
    tenant: str,
    namespace: str,
    topic: str,
    _user: CurrentApprovedUser,
    service: TopicSvc,
    audit: AuditSvc,
    request_info: RequestInfo,
    persistent: bool = Query(default=True, description="Persistent topic"),
) -> SuccessResponse:
    """Trigger compaction on a topic."""
    await service.compact_topic(tenant, namespace, topic, persistent=persistent)

    # Log audit event
    persistence = "persistent" if persistent else "non-persistent"
    await audit.log_event(
        action="compact",
        resource_type=ResourceType.TOPIC,
        resource_id=f"{persistence}://{tenant}/{namespace}/{topic}",
        **request_info,
    )

    return SuccessResponse(message=f"Compaction triggered for topic '{topic}'")


@router.post("/{topic}/offload", response_model=SuccessResponse)
async def offload_topic(
    tenant: str,
    namespace: str,
    topic: str,
    _user: CurrentApprovedUser,
    service: TopicSvc,
    audit: AuditSvc,
    request_info: RequestInfo,
    persistent: bool = Query(default=True, description="Persistent topic"),
) -> SuccessResponse:
    """Trigger offload on a topic."""
    await service.offload_topic(tenant, namespace, topic, persistent=persistent)

    # Log audit event
    persistence = "persistent" if persistent else "non-persistent"
    await audit.log_event(
        action="offload",
        resource_type=ResourceType.TOPIC,
        resource_id=f"{persistence}://{tenant}/{namespace}/{topic}",
        **request_info,
    )

    return SuccessResponse(message=f"Offload triggered for topic '{topic}'")


@router.post("/{topic}/truncate", response_model=SuccessResponse)
async def truncate_topic(
    tenant: str,
    namespace: str,
    topic: str,
    _user: CurrentApprovedUser,
    service: TopicSvc,
    audit: AuditSvc,
    request_info: RequestInfo,
    persistent: bool = Query(default=True, description="Persistent topic"),
) -> SuccessResponse:
    """Truncate a topic (delete all messages)."""
    await service.truncate_topic(tenant, namespace, topic, persistent=persistent)

    # Log audit event
    persistence = "persistent" if persistent else "non-persistent"
    await audit.log_event(
        action="truncate",
        resource_type=ResourceType.TOPIC,
        resource_id=f"{persistence}://{tenant}/{namespace}/{topic}",
        **request_info,
    )

    return SuccessResponse(message=f"Topic '{topic}' truncated")
