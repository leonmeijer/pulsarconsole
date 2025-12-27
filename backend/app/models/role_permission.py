"""Role-Permission mapping model for RBAC."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.role import Role
    from app.models.permission import Permission


class RolePermission(BaseModel):
    """Maps roles to permissions with optional resource patterns."""

    __tablename__ = "role_permissions"

    # References
    role_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    permission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("permissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Resource pattern (e.g., "public/default/*" or "public/default/my-topic")
    # NULL means all resources at the permission's resource level
    resource_pattern: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
        doc="Resource pattern like 'tenant/namespace/*' or specific resource path",
    )

    # Relationships
    role: Mapped["Role"] = relationship(
        "Role",
        back_populates="role_permissions",
    )
    permission: Mapped["Permission"] = relationship(
        "Permission",
        back_populates="role_permissions",
    )

    __table_args__ = (
        UniqueConstraint(
            "role_id", "permission_id", "resource_pattern",
            name="uq_role_perm_resource"
        ),
    )

    def __repr__(self) -> str:
        return f"<RolePermission(role_id='{self.role_id}', permission_id='{self.permission_id}', pattern='{self.resource_pattern}')>"

    def matches_resource(self, resource_path: str) -> bool:
        """
        Check if this permission applies to the given resource path.

        Args:
            resource_path: Full resource path like "public/default/my-topic"

        Returns:
            True if the permission applies to this resource
        """
        if self.resource_pattern is None:
            # NULL pattern means all resources
            return True

        pattern = self.resource_pattern

        # Exact match
        if pattern == resource_path:
            return True

        # Wildcard matching
        if pattern.endswith("/*"):
            prefix = pattern[:-2]  # Remove "/*"
            return resource_path.startswith(prefix + "/") or resource_path == prefix

        if pattern.endswith("/**"):
            prefix = pattern[:-3]  # Remove "/**"
            return resource_path.startswith(prefix)

        # Single wildcard in pattern
        if "*" in pattern:
            import fnmatch
            return fnmatch.fnmatch(resource_path, pattern)

        return False
