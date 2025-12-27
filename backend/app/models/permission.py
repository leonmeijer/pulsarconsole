"""Permission model for RBAC."""

import enum
from typing import TYPE_CHECKING

from sqlalchemy import String, Text, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.role_permission import RolePermission


class PermissionAction(str, enum.Enum):
    """Available permission actions (Pulsar operations)."""

    # Topic-level actions
    produce = "produce"
    consume = "consume"

    # Namespace-level actions
    functions = "functions"
    sources = "sources"
    sinks = "sinks"
    packages = "packages"

    # Administrative actions
    admin = "admin"
    read = "read"
    write = "write"


class ResourceLevel(str, enum.Enum):
    """Resource levels for permissions."""

    cluster = "cluster"
    tenant = "tenant"
    namespace = "namespace"
    topic = "topic"


class Permission(BaseModel):
    """Permission definition for RBAC."""

    __tablename__ = "permissions"

    # Permission definition
    action: Mapped[PermissionAction] = mapped_column(
        SQLEnum(PermissionAction),
        nullable=False,
    )
    resource_level: Mapped[ResourceLevel] = mapped_column(
        SQLEnum(ResourceLevel),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # Relationships
    role_permissions: Mapped[list["RolePermission"]] = relationship(
        "RolePermission",
        back_populates="permission",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Permission(action='{self.action}', resource_level='{self.resource_level}')>"

    @property
    def full_name(self) -> str:
        """Get full permission name like 'produce:topic'."""
        return f"{self.action.value}:{self.resource_level.value}"
