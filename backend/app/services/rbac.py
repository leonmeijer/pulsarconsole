"""RBAC (Role-Based Access Control) service."""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.role import Role
from app.models.permission import Permission, PermissionAction, ResourceLevel
from app.models.role_permission import RolePermission
from app.models.user_role import UserRole
from app.models.environment import Environment
from app.repositories.user import UserRepository
from app.repositories.role import RoleRepository
from app.repositories.permission import PermissionRepository, RolePermissionRepository
from app.repositories.user_role import UserRoleRepository
from app.repositories.environment import EnvironmentRepository
from app.db.seed_data import seed_rbac_data, PERMISSION_DEFINITIONS, DEFAULT_ROLES


class RBACService:
    """Service for Role-Based Access Control operations."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.user_repo = UserRepository(db)
        self.role_repo = RoleRepository(db)
        self.permission_repo = PermissionRepository(db)
        self.role_permission_repo = RolePermissionRepository(db)
        self.user_role_repo = UserRoleRepository(db)
        self.environment_repo = EnvironmentRepository(db)

    # =========================================================================
    # Environment RBAC Setup
    # =========================================================================

    async def setup_rbac_for_environment(self, environment_id: UUID) -> None:
        """
        Set up RBAC for an environment by seeding permissions and default roles.

        Args:
            environment_id: The environment to set up RBAC for
        """
        await seed_rbac_data(self.db, environment_id)

    async def is_rbac_enabled(self, environment_id: UUID) -> bool:
        """Check if RBAC is enabled for an environment."""
        env = await self.environment_repo.get_by_id(environment_id)
        return env.rbac_enabled if env else False

    async def has_superuser_access(self, user_id: UUID) -> bool:
        """
        Check if a user has superuser access.

        A user has superuser access if:
        - They are a global admin (is_global_admin=True), OR
        - They have the "superuser" role in any environment.
        """
        user = await self.user_repo.get_by_id(user_id)
        if user and user.is_global_admin:
            return True
        return await self.user_role_repo.has_role_by_name_any_environment(user_id, "superuser")

    async def enable_rbac(self, environment_id: UUID) -> Environment | None:
        """Enable RBAC for an environment and seed default roles."""
        env = await self.environment_repo.update(environment_id, rbac_enabled=True)
        if env:
            await self.setup_rbac_for_environment(environment_id)
            await self.db.commit()
        return env

    async def disable_rbac(self, environment_id: UUID) -> Environment | None:
        """Disable RBAC for an environment."""
        env = await self.environment_repo.update(environment_id, rbac_enabled=False)
        if env:
            await self.db.commit()
        return env

    # =========================================================================
    # Permission Management
    # =========================================================================

    async def get_all_permissions(self) -> list[Permission]:
        """Get all available permissions."""
        return await self.permission_repo.get_all()

    async def get_permissions_by_action(
        self, action: PermissionAction
    ) -> list[Permission]:
        """Get all permissions for a specific action."""
        return await self.permission_repo.get_by_action(action)

    async def get_permissions_by_resource_level(
        self, resource_level: ResourceLevel
    ) -> list[Permission]:
        """Get all permissions for a specific resource level."""
        return await self.permission_repo.get_by_resource_level(resource_level)

    async def get_permissions_grouped(self) -> dict[str, list[dict]]:
        """
        Get all permissions grouped by action for UI display.

        Returns:
            Dict with action names as keys and list of permission dicts as values
        """
        permissions = await self.permission_repo.get_all()

        grouped: dict[str, list[dict]] = {}
        for perm in permissions:
            action_name = perm.action.value
            if action_name not in grouped:
                grouped[action_name] = []
            grouped[action_name].append({
                "id": str(perm.id),
                "action": perm.action.value,
                "resource_level": perm.resource_level.value,
                "description": perm.description,
                "full_name": perm.full_name,
            })

        return grouped

    # =========================================================================
    # Role Management
    # =========================================================================

    async def get_roles(
        self,
        environment_id: UUID,
        include_system: bool = True
    ) -> list[Role]:
        """Get all roles for an environment."""
        return await self.role_repo.get_for_environment(
            environment_id, include_system=include_system
        )

    async def get_role(self, role_id: UUID) -> Role | None:
        """Get a role by ID with permissions loaded."""
        return await self.role_repo.get_with_permissions(role_id)

    async def get_role_by_name(
        self, environment_id: UUID, name: str
    ) -> Role | None:
        """Get a role by name within an environment."""
        return await self.role_repo.get_by_name(environment_id, name)

    async def create_role(
        self,
        environment_id: UUID,
        name: str,
        description: str | None = None,
        is_system: bool = False,
    ) -> Role:
        """
        Create a new role.

        Args:
            environment_id: The environment to create the role in
            name: Role name (must be unique within environment)
            description: Optional role description
            is_system: Whether this is a system role

        Returns:
            The created role

        Raises:
            ValueError: If a role with the same name already exists
        """
        existing = await self.role_repo.get_by_name(environment_id, name)
        if existing:
            raise ValueError(f"Role '{name}' already exists in this environment")

        role = await self.role_repo.create(
            environment_id=environment_id,
            name=name,
            description=description,
            is_system=is_system,
        )
        await self.db.commit()
        return role

    async def update_role(
        self,
        role_id: UUID,
        name: str | None = None,
        description: str | None = None,
    ) -> Role | None:
        """
        Update a role.

        Args:
            role_id: The role ID to update
            name: New role name (optional)
            description: New description (optional)

        Returns:
            Updated role or None if not found

        Raises:
            ValueError: If trying to rename to an existing name or modify system role name
        """
        role = await self.role_repo.get_by_id(role_id)
        if not role:
            return None

        if role.is_system and name and name != role.name:
            raise ValueError("Cannot rename system roles")

        if name and name != role.name:
            existing = await self.role_repo.get_by_name(role.environment_id, name)
            if existing:
                raise ValueError(f"Role '{name}' already exists in this environment")

        updates = {}
        if name:
            updates["name"] = name
        if description is not None:
            updates["description"] = description

        if updates:
            role = await self.role_repo.update(role_id, **updates)
            await self.db.commit()

        return role

    async def delete_role(self, role_id: UUID) -> bool:
        """
        Delete a role.

        Args:
            role_id: The role ID to delete

        Returns:
            True if deleted, False if not found or is system role
        """
        result = await self.role_repo.delete_non_system(role_id)
        if result:
            await self.db.commit()
        return result

    # =========================================================================
    # Role Permission Management
    # =========================================================================

    async def get_role_permissions(self, role_id: UUID) -> list[RolePermission]:
        """Get all permissions assigned to a role."""
        return await self.role_permission_repo.get_for_role(role_id)

    async def add_permission_to_role(
        self,
        role_id: UUID,
        permission_id: UUID,
        resource_pattern: str | None = None,
    ) -> RolePermission:
        """
        Add a permission to a role.

        Args:
            role_id: The role ID
            permission_id: The permission ID
            resource_pattern: Optional resource pattern (e.g., "tenant/*")

        Returns:
            The created role permission mapping
        """
        role_perm = await self.role_permission_repo.add_permission_to_role(
            role_id=role_id,
            permission_id=permission_id,
            resource_pattern=resource_pattern,
        )
        await self.db.commit()
        return role_perm

    async def remove_permission_from_role(
        self,
        role_id: UUID,
        permission_id: UUID,
        resource_pattern: str | None = None,
    ) -> bool:
        """
        Remove a permission from a role.

        Args:
            role_id: The role ID
            permission_id: The permission ID
            resource_pattern: The resource pattern to remove

        Returns:
            True if removed, False if not found
        """
        result = await self.role_permission_repo.remove_permission_from_role(
            role_id=role_id,
            permission_id=permission_id,
            resource_pattern=resource_pattern,
        )
        if result:
            await self.db.commit()
        return result

    async def set_role_permissions(
        self,
        role_id: UUID,
        permissions: list[dict],
    ) -> list[RolePermission]:
        """
        Set all permissions for a role (replace existing).

        Args:
            role_id: The role ID
            permissions: List of dicts with 'permission_id' and optional 'resource_pattern'

        Returns:
            List of created role permissions
        """
        # Get existing permissions
        existing = await self.role_permission_repo.get_for_role(role_id)

        # Delete all existing
        for rp in existing:
            await self.role_permission_repo.delete(rp.id)

        # Add new permissions
        new_permissions = []
        for perm in permissions:
            rp = await self.role_permission_repo.add_permission_to_role(
                role_id=role_id,
                permission_id=UUID(perm["permission_id"]),
                resource_pattern=perm.get("resource_pattern"),
            )
            new_permissions.append(rp)

        await self.db.commit()
        return new_permissions

    # =========================================================================
    # User Role Management
    # =========================================================================

    async def get_user_roles(
        self,
        user_id: UUID,
        environment_id: UUID | None = None
    ) -> list[UserRole]:
        """
        Get all roles assigned to a user.

        Args:
            user_id: The user ID
            environment_id: Optional environment to filter by

        Returns:
            List of user role assignments
        """
        if environment_id:
            return await self.user_role_repo.get_user_roles_for_environment(
                user_id, environment_id
            )
        return await self.user_role_repo.get_user_roles(user_id)

    async def get_role_users(self, role_id: UUID) -> list[UserRole]:
        """Get all users assigned to a role."""
        return await self.user_role_repo.get_role_users(role_id)

    async def assign_role_to_user(
        self,
        user_id: UUID,
        role_id: UUID,
        assigned_by: UUID | None = None,
    ) -> UserRole:
        """
        Assign a role to a user.

        Args:
            user_id: The user ID
            role_id: The role ID
            assigned_by: ID of the user making the assignment

        Returns:
            The created user role assignment

        Raises:
            ValueError: If the user already has this role
        """
        if await self.user_role_repo.has_role(user_id, role_id):
            raise ValueError("User already has this role")

        user_role = await self.user_role_repo.assign_role(
            user_id=user_id,
            role_id=role_id,
            assigned_by=assigned_by,
        )
        await self.db.commit()
        return user_role

    async def remove_role_from_user(
        self,
        user_id: UUID,
        role_id: UUID,
    ) -> bool:
        """
        Remove a role from a user.

        Args:
            user_id: The user ID
            role_id: The role ID

        Returns:
            True if removed, False if not found
        """
        result = await self.user_role_repo.remove_role(user_id, role_id)
        if result:
            await self.db.commit()
        return result

    async def set_user_roles(
        self,
        user_id: UUID,
        environment_id: UUID,
        role_ids: list[UUID],
        assigned_by: UUID | None = None,
    ) -> list[UserRole]:
        """
        Set all roles for a user in an environment (replace existing).

        Args:
            user_id: The user ID
            environment_id: The environment ID
            role_ids: List of role IDs to assign
            assigned_by: ID of the user making the assignment

        Returns:
            List of created user role assignments
        """
        # Get existing roles in this environment
        existing = await self.user_role_repo.get_user_roles_for_environment(
            user_id, environment_id
        )

        # Remove all existing
        for ur in existing:
            await self.user_role_repo.remove_role(user_id, ur.role_id)

        # Assign new roles
        new_assignments = []
        for role_id in role_ids:
            # Verify role belongs to environment
            role = await self.role_repo.get_by_id(role_id)
            if role and role.environment_id == environment_id:
                ur = await self.user_role_repo.assign_role(
                    user_id=user_id,
                    role_id=role_id,
                    assigned_by=assigned_by,
                )
                new_assignments.append(ur)

        await self.db.commit()
        return new_assignments

    # =========================================================================
    # Permission Checking
    # =========================================================================

    async def check_permission(
        self,
        user_id: UUID,
        environment_id: UUID,
        action: PermissionAction | str,
        resource_level: ResourceLevel | str,
        resource_path: str | None = None,
    ) -> bool:
        """
        Check if a user has a specific permission in an environment.

        Args:
            user_id: The user ID
            environment_id: The environment ID
            action: The permission action
            resource_level: The resource level
            resource_path: Optional resource path for pattern matching

        Returns:
            True if the user has the permission
        """
        # Check if user is superuser (via flag or superuser role)
        if await self.has_superuser_access(user_id):
            return True

        # Check if RBAC is enabled
        if not await self.is_rbac_enabled(environment_id):
            return True  # RBAC disabled = allow all

        # Convert strings to enums if needed
        if isinstance(action, str):
            action = PermissionAction(action)
        if isinstance(resource_level, str):
            resource_level = ResourceLevel(resource_level)

        return await self.user_role_repo.check_permission(
            user_id=user_id,
            environment_id=environment_id,
            action=action,
            resource_level=resource_level,
            resource_path=resource_path,
        )

    async def get_user_permissions(
        self,
        user_id: UUID,
        environment_id: UUID,
    ) -> list[dict]:
        """
        Get all effective permissions for a user in an environment.

        Args:
            user_id: The user ID
            environment_id: The environment ID

        Returns:
            List of permission dicts with action, resource_level, and patterns
        """
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            return []

        # Superusers have all permissions (via flag or superuser role)
        if await self.has_superuser_access(user_id):
            permissions = await self.permission_repo.get_all()
            return [
                {
                    "action": p.action.value,
                    "resource_level": p.resource_level.value,
                    "resource_pattern": None,  # All resources
                    "source": "superuser",
                }
                for p in permissions
            ]

        # Get all user roles in this environment
        user_roles = await self.user_role_repo.get_user_roles_for_environment(
            user_id, environment_id
        )

        # Collect all permissions from all roles
        permissions = []
        seen = set()

        for user_role in user_roles:
            role_perms = await self.role_permission_repo.get_for_role(user_role.role_id)
            role = await self.role_repo.get_by_id(user_role.role_id)

            for rp in role_perms:
                perm = await self.permission_repo.get_by_id(rp.permission_id)
                if perm:
                    key = (perm.action.value, perm.resource_level.value, rp.resource_pattern)
                    if key not in seen:
                        seen.add(key)
                        permissions.append({
                            "action": perm.action.value,
                            "resource_level": perm.resource_level.value,
                            "resource_pattern": rp.resource_pattern,
                            "source": f"role:{role.name}" if role else "unknown",
                        })

        return permissions

    # =========================================================================
    # User Management
    # =========================================================================

    async def get_users_with_roles(
        self,
        environment_id: UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> list[dict]:
        """
        Get all users with their roles in an environment.

        Args:
            environment_id: The environment ID
            skip: Pagination offset
            limit: Pagination limit

        Returns:
            List of user dicts with their roles
        """
        users = await self.user_repo.get_active_users(skip=skip, limit=limit)

        result = []
        for user in users:
            user_roles = await self.user_role_repo.get_user_roles_for_environment(
                user.id, environment_id
            )

            roles = []
            for ur in user_roles:
                role = await self.role_repo.get_by_id(ur.role_id)
                if role:
                    roles.append({
                        "id": str(role.id),
                        "name": role.name,
                        "is_system": role.is_system,
                        "assigned_at": ur.created_at.isoformat(),
                    })

            result.append({
                "id": str(user.id),
                "email": user.email,
                "display_name": user.display_name,
                "is_active": user.is_active,
                "roles": roles,
            })

        return result
