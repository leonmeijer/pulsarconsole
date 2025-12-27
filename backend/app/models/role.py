"""Role model for RBAC."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.environment import Environment
    from app.models.role_permission import RolePermission
    from app.models.user_role import UserRole


class Role(BaseModel):
    """Role definition for RBAC."""

    __tablename__ = "roles"

    # Environment reference (roles are per environment)
    environment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("environments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Role definition
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    # System roles cannot be deleted
    is_system: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Relationships
    environment: Mapped["Environment"] = relationship(
        "Environment",
        back_populates="roles",
    )
    role_permissions: Mapped[list["RolePermission"]] = relationship(
        "RolePermission",
        back_populates="role",
        cascade="all, delete-orphan",
    )
    user_roles: Mapped[list["UserRole"]] = relationship(
        "UserRole",
        back_populates="role",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("environment_id", "name", name="uq_role_env_name"),
    )

    def __repr__(self) -> str:
        return f"<Role(name='{self.name}', environment_id='{self.environment_id}')>"
