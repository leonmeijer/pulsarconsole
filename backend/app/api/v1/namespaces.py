"""Namespace API routes."""

from fastapi import APIRouter, Query, status

from app.api.deps import AuditSvc, NamespaceSvc, RequestInfo
from app.models.audit import ResourceType
from app.schemas import (
    NamespaceCreate,
    NamespaceDetailResponse,
    NamespaceListResponse,
    NamespaceResponse,
    NamespaceUpdate,
    SuccessResponse,
)

router = APIRouter(prefix="/tenants/{tenant}/namespaces", tags=["Namespaces"])


@router.get("", response_model=NamespaceListResponse)
async def list_namespaces(
    tenant: str,
    service: NamespaceSvc,
    use_cache: bool = Query(default=True, description="Use cached data"),
) -> NamespaceListResponse:
    """List all namespaces for a tenant."""
    namespaces = await service.get_namespaces(tenant, use_cache=use_cache)
    return NamespaceListResponse(
        namespaces=[NamespaceResponse(**ns) for ns in namespaces],
        total=len(namespaces),
    )


@router.get("/{namespace}", response_model=NamespaceDetailResponse)
async def get_namespace(
    tenant: str,
    namespace: str,
    service: NamespaceSvc,
) -> NamespaceDetailResponse:
    """Get namespace details."""
    data = await service.get_namespace(tenant, namespace)
    return NamespaceDetailResponse(**data)


@router.post("", response_model=NamespaceResponse, status_code=status.HTTP_201_CREATED)
async def create_namespace(
    tenant: str,
    data: NamespaceCreate,
    service: NamespaceSvc,
    audit: AuditSvc,
    request_info: RequestInfo,
) -> NamespaceResponse:
    """Create a new namespace."""
    result = await service.create_namespace(tenant, data.namespace)

    # Log audit event
    await audit.log_create(
        resource_type=ResourceType.NAMESPACE,
        resource_id=f"{tenant}/{data.namespace}",
        **request_info,
    )

    return NamespaceResponse(**result)


@router.put("/{namespace}", response_model=NamespaceDetailResponse)
async def update_namespace_policies(
    tenant: str,
    namespace: str,
    data: NamespaceUpdate,
    service: NamespaceSvc,
    audit: AuditSvc,
    request_info: RequestInfo,
) -> NamespaceDetailResponse:
    """Update namespace policies."""
    result = await service.update_policies(
        tenant=tenant,
        namespace=namespace,
        retention_time_minutes=data.retention_time_minutes,
        retention_size_mb=data.retention_size_mb,
        message_ttl_seconds=data.message_ttl_seconds,
        deduplication_enabled=data.deduplication_enabled,
        schema_compatibility_strategy=data.schema_compatibility_strategy,
    )

    # Log audit event
    await audit.log_update(
        resource_type=ResourceType.NAMESPACE,
        resource_id=f"{tenant}/{namespace}",
        details={
            "retention_time_minutes": data.retention_time_minutes,
            "retention_size_mb": data.retention_size_mb,
            "message_ttl_seconds": data.message_ttl_seconds,
            "deduplication_enabled": data.deduplication_enabled,
            "schema_compatibility_strategy": data.schema_compatibility_strategy,
        },
        **request_info,
    )

    return NamespaceDetailResponse(**result)


@router.delete("/{namespace}", response_model=SuccessResponse)
async def delete_namespace(
    tenant: str,
    namespace: str,
    service: NamespaceSvc,
    audit: AuditSvc,
    request_info: RequestInfo,
) -> SuccessResponse:
    """Delete a namespace."""
    await service.delete_namespace(tenant, namespace)

    # Log audit event
    await audit.log_delete(
        resource_type=ResourceType.NAMESPACE,
        resource_id=f"{tenant}/{namespace}",
        **request_info,
    )

    return SuccessResponse(message=f"Namespace '{tenant}/{namespace}' deleted")
