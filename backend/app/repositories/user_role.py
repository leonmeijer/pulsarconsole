"""User-Role repository for database operations."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.user_role import UserRole
from app.models.role import Role
from app.models.permission import PermissionAction, ResourceLevel
from app.repositories.base import BaseRepository


class UserRoleRepository(BaseRepository[UserRole]):
    """Repository for UserRole model operations."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(UserRole, session)

    async def get_user_roles(self, user_id: UUID) -> list[UserRole]:
        """Get all role assignments for a user."""
        result = await self.session.execute(
            select(UserRole)
            .where(UserRole.user_id == user_id)
            .options(selectinload(UserRole.role))
        )
        return list(result.scalars().all())

    async def get_user_roles_for_environment(
        self, user_id: UUID, environment_id: UUID
    ) -> list[UserRole]:
        """Get all role assignments for a user in a specific environment."""
        result = await self.session.execute(
            select(UserRole)
            .join(Role)
            .where(
                UserRole.user_id == user_id,
                Role.environment_id == environment_id
            )
            .options(selectinload(UserRole.role))
        )
        return list(result.scalars().all())

    async def get_role_users(self, role_id: UUID) -> list[UserRole]:
        """Get all user assignments for a role."""
        result = await self.session.execute(
            select(UserRole)
            .where(UserRole.role_id == role_id)
            .options(selectinload(UserRole.user))
        )
        return list(result.scalars().all())

    async def assign_role(
        self,
        user_id: UUID,
        role_id: UUID,
        assigned_by: UUID | None = None
    ) -> UserRole:
        """Assign a role to a user."""
        return await self.create(
            user_id=user_id,
            role_id=role_id,
            assigned_by=assigned_by
        )

    async def remove_role(self, user_id: UUID, role_id: UUID) -> bool:
        """Remove a role from a user."""
        result = await self.session.execute(
            select(UserRole).where(
                UserRole.user_id == user_id,
                UserRole.role_id == role_id
            )
        )
        user_role = result.scalar_one_or_none()
        if user_role is None:
            return False
        return await self.delete(user_role.id)

    async def has_role(self, user_id: UUID, role_id: UUID) -> bool:
        """Check if a user has a specific role."""
        result = await self.session.execute(
            select(UserRole).where(
                UserRole.user_id == user_id,
                UserRole.role_id == role_id
            )
        )
        return result.scalar_one_or_none() is not None

    async def has_role_by_name(
        self, user_id: UUID, environment_id: UUID, role_name: str
    ) -> bool:
        """Check if a user has a role by name in an environment."""
        result = await self.session.execute(
            select(UserRole)
            .join(Role)
            .where(
                UserRole.user_id == user_id,
                Role.environment_id == environment_id,
                Role.name == role_name
            )
        )
        return result.scalar_one_or_none() is not None

    async def has_role_by_name_any_environment(
        self, user_id: UUID, role_name: str
    ) -> bool:
        """Check if a user has a role by name in ANY environment."""
        result = await self.session.execute(
            select(UserRole)
            .join(Role)
            .where(
                UserRole.user_id == user_id,
                Role.name == role_name
            )
        )
        return result.scalar_one_or_none() is not None

    async def check_permission(
        self,
        user_id: UUID,
        environment_id: UUID,
        action: PermissionAction,
        resource_level: ResourceLevel,
        resource_path: str | None = None
    ) -> bool:
        """
        Check if a user has a specific permission in an environment.

        This checks all roles the user has in the environment and returns
        True if any of them grants the requested permission.

        Args:
            user_id: The user ID to check
            environment_id: The environment ID
            action: The permission action
            resource_level: The resource level
            resource_path: Optional resource path for pattern matching

        Returns:
            True if the user has the permission
        """
        from app.models.role_permission import RolePermission
        from app.models.permission import Permission

        # Get all role permissions for the user's roles in this environment
        result = await self.session.execute(
            select(RolePermission)
            .join(UserRole, UserRole.role_id == RolePermission.role_id)
            .join(Role, Role.id == UserRole.role_id)
            .join(Permission, Permission.id == RolePermission.permission_id)
            .where(
                UserRole.user_id == user_id,
                Role.environment_id == environment_id,
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
