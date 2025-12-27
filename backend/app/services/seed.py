"""Seed service for creating default permissions and roles."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.models.permission import Permission, PermissionAction, ResourceLevel
from app.models.role import Role
from app.models.role_permission import RolePermission
from app.models.user_role import UserRole

logger = get_logger(__name__)

# =============================================================================
# Default Permissions
# =============================================================================

DEFAULT_PERMISSIONS = [
    # Topic-level actions
    (PermissionAction.produce, ResourceLevel.topic, "Produce messages to topics"),
    (PermissionAction.consume, ResourceLevel.topic, "Consume messages from topics"),
    # Namespace-level actions
    (PermissionAction.functions, ResourceLevel.namespace, "Manage Pulsar Functions"),
    (PermissionAction.sources, ResourceLevel.namespace, "Manage Pulsar IO sources"),
    (PermissionAction.sinks, ResourceLevel.namespace, "Manage Pulsar IO sinks"),
    (PermissionAction.packages, ResourceLevel.namespace, "Manage packages"),
    # Administrative actions - cluster level
    (PermissionAction.admin, ResourceLevel.cluster, "Full cluster administration"),
    (PermissionAction.read, ResourceLevel.cluster, "Read cluster information"),
    # Administrative actions - tenant level
    (PermissionAction.admin, ResourceLevel.tenant, "Full tenant administration"),
    (PermissionAction.read, ResourceLevel.tenant, "Read tenant information"),
    (PermissionAction.write, ResourceLevel.tenant, "Create/modify tenants"),
    # Administrative actions - namespace level
    (PermissionAction.admin, ResourceLevel.namespace, "Full namespace administration"),
    (PermissionAction.read, ResourceLevel.namespace, "Read namespace information"),
    (PermissionAction.write, ResourceLevel.namespace, "Create/modify namespaces"),
    # Administrative actions - topic level
    (PermissionAction.read, ResourceLevel.topic, "Read topic information"),
    (PermissionAction.write, ResourceLevel.topic, "Create/modify/delete topics"),
]

# =============================================================================
# Default Roles with their permissions
# =============================================================================

DEFAULT_ROLES = {
    "superuser": {
        "description": "Full system access - all permissions on all resources",
        "is_system": True,
        "permissions": [
            # All admin permissions
            (PermissionAction.admin, ResourceLevel.cluster),
            (PermissionAction.admin, ResourceLevel.tenant),
            (PermissionAction.admin, ResourceLevel.namespace),
            # All read/write permissions
            (PermissionAction.read, ResourceLevel.cluster),
            (PermissionAction.read, ResourceLevel.tenant),
            (PermissionAction.read, ResourceLevel.namespace),
            (PermissionAction.read, ResourceLevel.topic),
            (PermissionAction.write, ResourceLevel.tenant),
            (PermissionAction.write, ResourceLevel.namespace),
            (PermissionAction.write, ResourceLevel.topic),
            # All topic operations
            (PermissionAction.produce, ResourceLevel.topic),
            (PermissionAction.consume, ResourceLevel.topic),
            # All namespace operations
            (PermissionAction.functions, ResourceLevel.namespace),
            (PermissionAction.sources, ResourceLevel.namespace),
            (PermissionAction.sinks, ResourceLevel.namespace),
            (PermissionAction.packages, ResourceLevel.namespace),
        ],
    },
    "admin": {
        "description": "Administrative access to tenants and namespaces",
        "is_system": True,
        "permissions": [
            (PermissionAction.admin, ResourceLevel.tenant),
            (PermissionAction.admin, ResourceLevel.namespace),
            (PermissionAction.read, ResourceLevel.cluster),
            (PermissionAction.read, ResourceLevel.tenant),
            (PermissionAction.read, ResourceLevel.namespace),
            (PermissionAction.read, ResourceLevel.topic),
            (PermissionAction.write, ResourceLevel.tenant),
            (PermissionAction.write, ResourceLevel.namespace),
            (PermissionAction.write, ResourceLevel.topic),
            (PermissionAction.produce, ResourceLevel.topic),
            (PermissionAction.consume, ResourceLevel.topic),
            (PermissionAction.functions, ResourceLevel.namespace),
            (PermissionAction.sources, ResourceLevel.namespace),
            (PermissionAction.sinks, ResourceLevel.namespace),
            (PermissionAction.packages, ResourceLevel.namespace),
        ],
    },
    "operator": {
        "description": "Operational access - read all, manage topics and messages",
        "is_system": True,
        "permissions": [
            (PermissionAction.read, ResourceLevel.cluster),
            (PermissionAction.read, ResourceLevel.tenant),
            (PermissionAction.read, ResourceLevel.namespace),
            (PermissionAction.read, ResourceLevel.topic),
            (PermissionAction.write, ResourceLevel.topic),
            (PermissionAction.produce, ResourceLevel.topic),
            (PermissionAction.consume, ResourceLevel.topic),
        ],
    },
    "developer": {
        "description": "Developer access - read all, produce and consume messages",
        "is_system": True,
        "permissions": [
            (PermissionAction.read, ResourceLevel.cluster),
            (PermissionAction.read, ResourceLevel.tenant),
            (PermissionAction.read, ResourceLevel.namespace),
            (PermissionAction.read, ResourceLevel.topic),
            (PermissionAction.produce, ResourceLevel.topic),
            (PermissionAction.consume, ResourceLevel.topic),
        ],
    },
    "viewer": {
        "description": "Read-only access to all resources",
        "is_system": True,
        "permissions": [
            (PermissionAction.read, ResourceLevel.cluster),
            (PermissionAction.read, ResourceLevel.tenant),
            (PermissionAction.read, ResourceLevel.namespace),
            (PermissionAction.read, ResourceLevel.topic),
        ],
    },
}


class SeedService:
    """Service for seeding default data."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self._permission_cache: dict[tuple[PermissionAction, ResourceLevel], UUID] = {}

    async def seed_permissions(self) -> dict[tuple[PermissionAction, ResourceLevel], UUID]:
        """Create default permissions if they don't exist.

        Returns a mapping of (action, resource_level) -> permission_id
        """
        permission_map: dict[tuple[PermissionAction, ResourceLevel], UUID] = {}

        for action, resource_level, description in DEFAULT_PERMISSIONS:
            # Check if permission exists
            result = await self.session.execute(
                select(Permission).where(
                    Permission.action == action,
                    Permission.resource_level == resource_level,
                )
            )
            permission = result.scalar_one_or_none()

            if not permission:
                permission = Permission(
                    action=action,
                    resource_level=resource_level,
                    description=description,
                )
                self.session.add(permission)
                await self.session.flush()
                logger.info(
                    "Created permission",
                    action=action.value,
                    resource_level=resource_level.value,
                )

            permission_map[(action, resource_level)] = permission.id

        self._permission_cache = permission_map
        return permission_map

    async def seed_roles_for_environment(self, environment_id: UUID) -> dict[str, UUID]:
        """Create default roles for an environment if they don't exist.

        Returns a mapping of role_name -> role_id
        """
        # Ensure permissions exist
        if not self._permission_cache:
            await self.seed_permissions()

        role_map: dict[str, UUID] = {}

        for role_name, role_config in DEFAULT_ROLES.items():
            # Check if role exists for this environment
            result = await self.session.execute(
                select(Role).where(
                    Role.name == role_name,
                    Role.environment_id == environment_id,
                )
            )
            role = result.scalar_one_or_none()

            if not role:
                role = Role(
                    name=role_name,
                    description=role_config["description"],
                    is_system=role_config["is_system"],
                    environment_id=environment_id,
                )
                self.session.add(role)
                await self.session.flush()
                logger.info(
                    "Created role",
                    role=role_name,
                    environment_id=str(environment_id),
                )

                # Add permissions to role
                for action, resource_level in role_config["permissions"]:
                    permission_id = self._permission_cache.get((action, resource_level))
                    if permission_id:
                        role_permission = RolePermission(
                            role_id=role.id,
                            permission_id=permission_id,
                            resource_pattern="*",  # All resources
                        )
                        self.session.add(role_permission)

                await self.session.flush()

            role_map[role_name] = role.id

        return role_map

    async def seed_all_environments(self) -> None:
        """Seed roles for all existing environments."""
        from app.models.environment import Environment

        result = await self.session.execute(select(Environment))
        environments = result.scalars().all()

        # First seed permissions
        await self.seed_permissions()

        # Then seed roles for each environment
        for env in environments:
            await self.seed_roles_for_environment(env.id)
            logger.info("Seeded roles for environment", environment=env.name)

        await self.session.commit()

    async def get_superuser_role_id(self, environment_id: UUID) -> UUID | None:
        """Get the superuser role ID for an environment."""
        result = await self.session.execute(
            select(Role.id).where(
                Role.name == "superuser",
                Role.environment_id == environment_id,
            )
        )
        return result.scalar_one_or_none()

    async def assign_user_to_superuser_role(
        self, user_id: UUID, environment_id: UUID, assigned_by: UUID | None = None
    ) -> bool:
        """Assign a user to the superuser role for an environment.

        Returns True if assignment was created, False if already exists.
        """
        role_id = await self.get_superuser_role_id(environment_id)
        if not role_id:
            logger.warning(
                "Superuser role not found for environment",
                environment_id=str(environment_id),
            )
            return False

        # Check if assignment exists
        result = await self.session.execute(
            select(UserRole).where(
                UserRole.user_id == user_id,
                UserRole.role_id == role_id,
            )
        )
        if result.scalar_one_or_none():
            return False  # Already assigned

        user_role = UserRole(
            user_id=user_id,
            role_id=role_id,
            assigned_by=assigned_by,
        )
        self.session.add(user_role)
        await self.session.flush()
        logger.info(
            "Assigned user to superuser role",
            user_id=str(user_id),
            environment_id=str(environment_id),
        )
        return True

    async def assign_user_to_superuser_role_all_environments(
        self, user_id: UUID
    ) -> int:
        """Assign a user to the superuser role for ALL environments.

        Returns the number of assignments created.
        """
        from app.models.environment import Environment

        result = await self.session.execute(select(Environment.id))
        environment_ids = result.scalars().all()

        count = 0
        for env_id in environment_ids:
            if await self.assign_user_to_superuser_role(user_id, env_id):
                count += 1

        return count
