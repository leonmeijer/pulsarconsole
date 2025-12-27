"""Tenant API routes."""

from fastapi import APIRouter, Query, status

from app.api.deps import AuditSvc, CurrentApprovedUser, RequestInfo, TenantSvc
from app.models.audit import ActionType, ResourceType
from app.schemas import (
    SuccessResponse,
    TenantCreate,
    TenantDetailResponse,
    TenantListResponse,
    TenantResponse,
    TenantUpdate,
)

router = APIRouter(prefix="/tenants", tags=["Tenants"])


@router.get("", response_model=TenantListResponse)
async def list_tenants(
    _user: CurrentApprovedUser,
    service: TenantSvc,
    use_cache: bool = Query(default=True, description="Use cached data"),
) -> TenantListResponse:
    """List all tenants."""
    tenants = await service.get_tenants(use_cache=use_cache)
    return TenantListResponse(
        tenants=[TenantResponse(**t) for t in tenants],
        total=len(tenants),
    )


@router.get("/{tenant}", response_model=TenantDetailResponse)
async def get_tenant(tenant: str, _user: CurrentApprovedUser, service: TenantSvc) -> TenantDetailResponse:
    """Get tenant details."""
    data = await service.get_tenant(tenant)
    return TenantDetailResponse(**data)


@router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    data: TenantCreate,
    _user: CurrentApprovedUser,
    service: TenantSvc,
    audit: AuditSvc,
    request_info: RequestInfo,
) -> TenantResponse:
    """Create a new tenant."""
    result = await service.create_tenant(
        name=data.name,
        admin_roles=data.admin_roles,
        allowed_clusters=data.allowed_clusters,
    )

    # Log audit event
    await audit.log_create(
        resource_type=ResourceType.TENANT,
        resource_id=data.name,
        details={"admin_roles": data.admin_roles, "allowed_clusters": data.allowed_clusters},
        **request_info,
    )

    return TenantResponse(**result)


@router.put("/{tenant}", response_model=TenantDetailResponse)
async def update_tenant(
    tenant: str,
    data: TenantUpdate,
    _user: CurrentApprovedUser,
    service: TenantSvc,
    audit: AuditSvc,
    request_info: RequestInfo,
) -> TenantDetailResponse:
    """Update tenant configuration."""
    result = await service.update_tenant(
        name=tenant,
        admin_roles=data.admin_roles,
        allowed_clusters=data.allowed_clusters,
    )

    # Log audit event
    await audit.log_update(
        resource_type=ResourceType.TENANT,
        resource_id=tenant,
        details={"admin_roles": data.admin_roles, "allowed_clusters": data.allowed_clusters},
        **request_info,
    )

    return TenantDetailResponse(**result)


@router.delete("/{tenant}", response_model=SuccessResponse)
async def delete_tenant(
    tenant: str,
    _user: CurrentApprovedUser,
    service: TenantSvc,
    audit: AuditSvc,
    request_info: RequestInfo,
) -> SuccessResponse:
    """Delete a tenant."""
    await service.delete_tenant(tenant)

    # Log audit event
    await audit.log_delete(
        resource_type=ResourceType.TENANT,
        resource_id=tenant,
        **request_info,
    )

    return SuccessResponse(message=f"Tenant '{tenant}' deleted")
