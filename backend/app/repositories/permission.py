"""Permission repository for database operations."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.permission import Permission, PermissionAction, ResourceLevel
from app.models.role_permission import RolePermission
from app.repositories.base import BaseRepository


class PermissionRepository(BaseRepository[Permission]):
    """Repository for Permission model operations."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Permission, session)

    async def get_by_action_and_level(
        self, action: PermissionAction, resource_level: ResourceLevel
    ) -> Permission | None:
        """Get a permission by action and resource level."""
        result = await self.session.execute(
            select(Permission).where(
                Permission.action == action,
                Permission.resource_level == resource_level
            )
        )
        return result.scalar_one_or_none()

    async def get_by_action(
        self, action: PermissionAction
    ) -> list[Permission]:
        """Get all permissions for an action."""
        result = await self.session.execute(
            select(Permission).where(Permission.action == action)
        )
        return list(result.scalars().all())

    async def get_by_resource_level(
        self, resource_level: ResourceLevel
    ) -> list[Permission]:
        """Get all permissions for a resource level."""
        result = await self.session.execute(
            select(Permission).where(Permission.resource_level == resource_level)
        )
        return list(result.scalars().all())

    async def get_all_grouped_by_action(self) -> dict[str, list[Permission]]:
        """Get all permissions grouped by action."""
        result = await self.session.execute(select(Permission))
        permissions = list(result.scalars().all())

        grouped: dict[str, list[Permission]] = {}
        for perm in permissions:
            action_name = perm.action.value
            if action_name not in grouped:
                grouped[action_name] = []
            grouped[action_name].append(perm)

        return grouped


class RolePermissionRepository(BaseRepository[RolePermission]):
    """Repository for RolePermission model operations."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(RolePermission, session)

    async def get_for_role(self, role_id: UUID) -> list[RolePermission]:
        """Get all permission mappings for a role."""
        result = await self.session.execute(
            select(RolePermission).where(RolePermission.role_id == role_id)
        )
        return list(result.scalars().all())

    async def add_permission_to_role(
        self,
        role_id: UUID,
        permission_id: UUID,
        resource_pattern: str | None = None
    ) -> RolePermission:
        """Add a permission to a role with optional resource pattern."""
        return await self.create(
            role_id=role_id,
            permission_id=permission_id,
            resource_pattern=resource_pattern
        )

    async def remove_permission_from_role(
        self,
        role_id: UUID,
        permission_id: UUID,
        resource_pattern: str | None = None
    ) -> bool:
        """Remove a permission from a role."""
        result = await self.session.execute(
            select(RolePermission).where(
                RolePermission.role_id == role_id,
                RolePermission.permission_id == permission_id,
                RolePermission.resource_pattern == resource_pattern
            )
        )
        role_perm = result.scalar_one_or_none()
        if role_perm is None:
            return False
        return await self.delete(role_perm.id)

    async def check_permission(
        self,
        role_id: UUID,
        action: PermissionAction,
        resource_level: ResourceLevel,
        resource_path: str | None = None
    ) -> bool:
        """
        Check if a role has a specific permission.

        Args:
            role_id: The role ID to check
            action: The permission action
            resource_level: The resource level
            resource_path: Optional resource path for pattern matching

        Returns:
            True if the role has the permission
        """
        # Get all role permissions for this role
        result = await self.session.execute(
            select(RolePermission)
            .join(Permission)
            .where(
                RolePermission.role_id == role_id,
                Permission.action == action,
                Permission.resource_level == resource_level
            )
        )
        role_permissions = list(result.scalars().all())

        if not role_permissions:
            return False

        if resource_path is None:
            # No specific resource, just check if permission exists
            return True

        # Check if any permission matches the resource path
        for role_perm in role_permissions:
            if role_perm.matches_resource(resource_path):
                return True

        return False
