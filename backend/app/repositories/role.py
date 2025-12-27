"""Role repository for database operations."""

from uuid import UUID

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.role import Role
from app.repositories.base import BaseRepository


class RoleRepository(BaseRepository[Role]):
    """Repository for Role model operations."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Role, session)

    async def get_by_name(
        self, environment_id: UUID, name: str
    ) -> Role | None:
        """Get a role by name within an environment."""
        result = await self.session.execute(
            select(Role).where(
                Role.environment_id == environment_id,
                Role.name == name
            )
        )
        return result.scalar_one_or_none()

    async def get_for_environment(
        self,
        environment_id: UUID,
        include_system: bool = True
    ) -> list[Role]:
        """Get all roles for an environment."""
        query = select(Role).where(Role.environment_id == environment_id)

        if not include_system:
            query = query.where(Role.is_system == False)

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_with_permissions(self, role_id: UUID) -> Role | None:
        """Get a role with its permissions loaded."""
        result = await self.session.execute(
            select(Role)
            .where(Role.id == role_id)
            .options(
                selectinload(Role.role_permissions).selectinload("permission")
            )
        )
        return result.scalar_one_or_none()

    async def get_system_roles(self, environment_id: UUID) -> list[Role]:
        """Get all system roles for an environment."""
        result = await self.session.execute(
            select(Role).where(
                Role.environment_id == environment_id,
                Role.is_system == True
            )
        )
        return list(result.scalars().all())

    async def delete_non_system(self, role_id: UUID) -> bool:
        """Delete a role if it's not a system role."""
        role = await self.get_by_id(role_id)
        if role is None:
            return False
        if role.is_system:
            return False  # Cannot delete system roles
        return await self.delete(role_id)

    async def create_system_role(
        self,
        environment_id: UUID,
        name: str,
        description: str | None = None
    ) -> Role:
        """Create a system role."""
        return await self.create(
            environment_id=environment_id,
            name=name,
            description=description,
            is_system=True
        )
