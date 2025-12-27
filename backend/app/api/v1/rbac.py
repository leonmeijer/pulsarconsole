"""RBAC (Role-Based Access Control) API endpoints."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import (
    get_db,
    get_current_active_user,
    get_current_superuser,
    CurrentActiveUser,
    CurrentSuperuser,
)
from app.models.user import User
from app.services.rbac import RBACService

router = APIRouter(prefix="/rbac", tags=["rbac"])


# =============================================================================
# Request/Response Models
# =============================================================================


class PermissionInfo(BaseModel):
    """Permission information."""

    id: str
    action: str
    resource_level: str
    description: str | None
    full_name: str


class PermissionsResponse(BaseModel):
    """All permissions grouped by action."""

    permissions: dict[str, list[PermissionInfo]]


class RolePermissionInfo(BaseModel):
    """Role permission with pattern."""

    permission_id: str
    action: str
    resource_level: str
    resource_pattern: str | None


class RoleInfo(BaseModel):
    """Role information."""

    id: str
    name: str
    description: str | None
    is_system: bool
    permissions: list[RolePermissionInfo] = []


class RolesResponse(BaseModel):
    """List of roles."""

    roles: list[RoleInfo]


class CreateRoleRequest(BaseModel):
    """Create role request."""

    name: str
    description: str | None = None


class UpdateRoleRequest(BaseModel):
    """Update role request."""

    name: str | None = None
    description: str | None = None


class AddPermissionRequest(BaseModel):
    """Add permission to role request."""

    permission_id: str
    resource_pattern: str | None = None


class SetPermissionsRequest(BaseModel):
    """Set role permissions request."""

    permissions: list[AddPermissionRequest]


class UserRoleInfo(BaseModel):
    """User role assignment info."""

    role_id: str
    role_name: str
    is_system: bool
    assigned_at: str


class UserWithRoles(BaseModel):
    """User with their roles."""

    id: str
    email: str
    display_name: str | None
    is_active: bool
    roles: list[UserRoleInfo]


class UsersResponse(BaseModel):
    """List of users with roles."""

    users: list[UserWithRoles]


class AssignRoleRequest(BaseModel):
    """Assign role to user request."""

    role_id: str


class SetUserRolesRequest(BaseModel):
    """Set user roles request."""

    role_ids: list[str]


class CheckPermissionRequest(BaseModel):
    """Permission check request."""

    action: str
    resource_level: str
    resource_path: str | None = None


class CheckPermissionResponse(BaseModel):
    """Permission check response."""

    allowed: bool
    reason: str | None = None


class UserPermissionInfo(BaseModel):
    """User permission info."""

    action: str
    resource_level: str
    resource_pattern: str | None
    source: str


class UserPermissionsResponse(BaseModel):
    """User permissions response."""

    permissions: list[UserPermissionInfo]


# =============================================================================
# Helper Functions
# =============================================================================


async def get_rbac_service(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> RBACService:
    """Get RBAC service."""
    return RBACService(db)


async def get_active_environment_id(
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UUID:
    """Get the active environment ID."""
    from app.repositories.environment import EnvironmentRepository

    env_repo = EnvironmentRepository(db)
    env = await env_repo.get_active()

    if not env:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active environment configured",
        )

    return env.id


RBACServiceDep = Annotated[RBACService, Depends(get_rbac_service)]
EnvironmentId = Annotated[UUID, Depends(get_active_environment_id)]


# =============================================================================
# Permission Endpoints
# =============================================================================


@router.get("/permissions", response_model=PermissionsResponse)
async def get_permissions(
    current_user: CurrentActiveUser,
    rbac: RBACServiceDep,
) -> PermissionsResponse:
    """Get all available permissions grouped by action."""
    grouped = await rbac.get_permissions_grouped()

    # Convert to response format
    permissions = {}
    for action, perms in grouped.items():
        permissions[action] = [
            PermissionInfo(
                id=p["id"],
                action=p["action"],
                resource_level=p["resource_level"],
                description=p["description"],
                full_name=p["full_name"],
            )
            for p in perms
        ]

    return PermissionsResponse(permissions=permissions)


# =============================================================================
# Role Endpoints
# =============================================================================


@router.get("/roles", response_model=RolesResponse)
async def get_roles(
    current_user: CurrentActiveUser,
    rbac: RBACServiceDep,
    environment_id: EnvironmentId,
    include_system: bool = True,
) -> RolesResponse:
    """Get all roles for the active environment."""
    roles = await rbac.get_roles(environment_id, include_system=include_system)

    role_infos = []
    for role in roles:
        # Get permissions for this role
        role_perms = await rbac.get_role_permissions(role.id)

        permissions = []
        for rp in role_perms:
            perm = await rbac.permission_repo.get_by_id(rp.permission_id)
            if perm:
                permissions.append(
                    RolePermissionInfo(
                        permission_id=str(rp.permission_id),
                        action=perm.action.value,
                        resource_level=perm.resource_level.value,
                        resource_pattern=rp.resource_pattern,
                    )
                )

        role_infos.append(
            RoleInfo(
                id=str(role.id),
                name=role.name,
                description=role.description,
                is_system=role.is_system,
                permissions=permissions,
            )
        )

    return RolesResponse(roles=role_infos)


@router.get("/roles/{role_id}", response_model=RoleInfo)
async def get_role(
    role_id: UUID,
    current_user: CurrentActiveUser,
    rbac: RBACServiceDep,
) -> RoleInfo:
    """Get a specific role by ID."""
    role = await rbac.get_role(role_id)

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )

    # Get permissions
    role_perms = await rbac.get_role_permissions(role_id)

    permissions = []
    for rp in role_perms:
        perm = await rbac.permission_repo.get_by_id(rp.permission_id)
        if perm:
            permissions.append(
                RolePermissionInfo(
                    permission_id=str(rp.permission_id),
                    action=perm.action.value,
                    resource_level=perm.resource_level.value,
                    resource_pattern=rp.resource_pattern,
                )
            )

    return RoleInfo(
        id=str(role.id),
        name=role.name,
        description=role.description,
        is_system=role.is_system,
        permissions=permissions,
    )


@router.post("/roles", response_model=RoleInfo, status_code=status.HTTP_201_CREATED)
async def create_role(
    request: CreateRoleRequest,
    current_user: CurrentSuperuser,
    rbac: RBACServiceDep,
    environment_id: EnvironmentId,
) -> RoleInfo:
    """Create a new role. Requires superuser privileges."""
    try:
        role = await rbac.create_role(
            environment_id=environment_id,
            name=request.name,
            description=request.description,
        )

        return RoleInfo(
            id=str(role.id),
            name=role.name,
            description=role.description,
            is_system=role.is_system,
            permissions=[],
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.put("/roles/{role_id}", response_model=RoleInfo)
async def update_role(
    role_id: UUID,
    request: UpdateRoleRequest,
    current_user: CurrentSuperuser,
    rbac: RBACServiceDep,
) -> RoleInfo:
    """Update a role. Requires superuser privileges."""
    try:
        role = await rbac.update_role(
            role_id=role_id,
            name=request.name,
            description=request.description,
        )

        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Role not found",
            )

        # Get permissions
        role_perms = await rbac.get_role_permissions(role_id)

        permissions = []
        for rp in role_perms:
            perm = await rbac.permission_repo.get_by_id(rp.permission_id)
            if perm:
                permissions.append(
                    RolePermissionInfo(
                        permission_id=str(rp.permission_id),
                        action=perm.action.value,
                        resource_level=perm.resource_level.value,
                        resource_pattern=rp.resource_pattern,
                    )
                )

        return RoleInfo(
            id=str(role.id),
            name=role.name,
            description=role.description,
            is_system=role.is_system,
            permissions=permissions,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: UUID,
    current_user: CurrentSuperuser,
    rbac: RBACServiceDep,
) -> None:
    """Delete a role. Requires superuser privileges. Cannot delete system roles."""
    result = await rbac.delete_role(role_id)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role not found or is a system role",
        )


# =============================================================================
# Role Permission Endpoints
# =============================================================================


@router.post("/roles/{role_id}/permissions", response_model=RoleInfo)
async def add_permission_to_role(
    role_id: UUID,
    request: AddPermissionRequest,
    current_user: CurrentSuperuser,
    rbac: RBACServiceDep,
) -> RoleInfo:
    """Add a permission to a role. Requires superuser privileges."""
    role = await rbac.get_role(role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )

    await rbac.add_permission_to_role(
        role_id=role_id,
        permission_id=UUID(request.permission_id),
        resource_pattern=request.resource_pattern,
    )

    # Return updated role
    return await get_role(role_id, current_user, rbac)


@router.delete("/roles/{role_id}/permissions/{permission_id}")
async def remove_permission_from_role(
    role_id: UUID,
    permission_id: UUID,
    current_user: CurrentSuperuser,
    rbac: RBACServiceDep,
    resource_pattern: str | None = None,
) -> dict:
    """Remove a permission from a role. Requires superuser privileges."""
    result = await rbac.remove_permission_from_role(
        role_id=role_id,
        permission_id=permission_id,
        resource_pattern=resource_pattern,
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found on role",
        )

    return {"message": "Permission removed"}


@router.put("/roles/{role_id}/permissions", response_model=RoleInfo)
async def set_role_permissions(
    role_id: UUID,
    request: SetPermissionsRequest,
    current_user: CurrentSuperuser,
    rbac: RBACServiceDep,
) -> RoleInfo:
    """Set all permissions for a role (replaces existing). Requires superuser privileges."""
    role = await rbac.get_role(role_id)
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found",
        )

    permissions = [
        {
            "permission_id": p.permission_id,
            "resource_pattern": p.resource_pattern,
        }
        for p in request.permissions
    ]

    await rbac.set_role_permissions(role_id, permissions)

    # Return updated role
    return await get_role(role_id, current_user, rbac)


# =============================================================================
# User Role Endpoints
# =============================================================================


@router.get("/users", response_model=UsersResponse)
async def get_users_with_roles(
    current_user: CurrentActiveUser,
    rbac: RBACServiceDep,
    environment_id: EnvironmentId,
    skip: int = 0,
    limit: int = 100,
) -> UsersResponse:
    """Get all users with their roles in the active environment."""
    users_data = await rbac.get_users_with_roles(
        environment_id=environment_id,
        skip=skip,
        limit=limit,
    )

    users = [
        UserWithRoles(
            id=u["id"],
            email=u["email"],
            display_name=u["display_name"],
            is_active=u["is_active"],
            roles=[
                UserRoleInfo(
                    role_id=r["id"],
                    role_name=r["name"],
                    is_system=r["is_system"],
                    assigned_at=r["assigned_at"],
                )
                for r in u["roles"]
            ],
        )
        for u in users_data
    ]

    return UsersResponse(users=users)


@router.post("/users/{user_id}/roles")
async def assign_role_to_user(
    user_id: UUID,
    request: AssignRoleRequest,
    current_user: CurrentSuperuser,
    rbac: RBACServiceDep,
) -> dict:
    """Assign a role to a user. Requires superuser privileges."""
    try:
        await rbac.assign_role_to_user(
            user_id=user_id,
            role_id=UUID(request.role_id),
            assigned_by=current_user.id,
        )
        return {"message": "Role assigned"}

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )


@router.delete("/users/{user_id}/roles/{role_id}")
async def remove_role_from_user(
    user_id: UUID,
    role_id: UUID,
    current_user: CurrentSuperuser,
    rbac: RBACServiceDep,
) -> dict:
    """Remove a role from a user. Requires superuser privileges."""
    result = await rbac.remove_role_from_user(user_id, role_id)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User does not have this role",
        )

    return {"message": "Role removed"}


@router.put("/users/{user_id}/roles")
async def set_user_roles(
    user_id: UUID,
    request: SetUserRolesRequest,
    current_user: CurrentSuperuser,
    rbac: RBACServiceDep,
    environment_id: EnvironmentId,
) -> dict:
    """Set all roles for a user (replaces existing). Requires superuser privileges."""
    role_ids = [UUID(rid) for rid in request.role_ids]

    await rbac.set_user_roles(
        user_id=user_id,
        environment_id=environment_id,
        role_ids=role_ids,
        assigned_by=current_user.id,
    )

    return {"message": "Roles updated"}


# =============================================================================
# Permission Check Endpoints
# =============================================================================


@router.post("/check", response_model=CheckPermissionResponse)
async def check_permission(
    request: CheckPermissionRequest,
    current_user: CurrentActiveUser,
    rbac: RBACServiceDep,
    environment_id: EnvironmentId,
) -> CheckPermissionResponse:
    """Check if the current user has a specific permission."""
    allowed = await rbac.check_permission(
        user_id=current_user.id,
        environment_id=environment_id,
        action=request.action,
        resource_level=request.resource_level,
        resource_path=request.resource_path,
    )

    reason = "role_permission" if allowed else "no_permission"

    return CheckPermissionResponse(allowed=allowed, reason=reason)


@router.get("/my-permissions", response_model=UserPermissionsResponse)
async def get_my_permissions(
    current_user: CurrentActiveUser,
    rbac: RBACServiceDep,
    environment_id: EnvironmentId,
) -> UserPermissionsResponse:
    """Get all effective permissions for the current user."""
    permissions = await rbac.get_user_permissions(
        user_id=current_user.id,
        environment_id=environment_id,
    )

    return UserPermissionsResponse(
        permissions=[
            UserPermissionInfo(
                action=p["action"],
                resource_level=p["resource_level"],
                resource_pattern=p["resource_pattern"],
                source=p["source"],
            )
            for p in permissions
        ]
    )


@router.get("/users/{user_id}/permissions", response_model=UserPermissionsResponse)
async def get_user_permissions(
    user_id: UUID,
    current_user: CurrentSuperuser,
    rbac: RBACServiceDep,
    environment_id: EnvironmentId,
) -> UserPermissionsResponse:
    """Get all effective permissions for a user. Requires superuser privileges."""
    permissions = await rbac.get_user_permissions(
        user_id=user_id,
        environment_id=environment_id,
    )

    return UserPermissionsResponse(
        permissions=[
            UserPermissionInfo(
                action=p["action"],
                resource_level=p["resource_level"],
                resource_pattern=p["resource_pattern"],
                source=p["source"],
            )
            for p in permissions
        ]
    )
