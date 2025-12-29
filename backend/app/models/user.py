"""User model for authentication."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.dialects.postgresql import UUID, INET
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.session import Session
    from app.models.user_role import UserRole
    from app.models.api_token import ApiToken


class User(BaseModel):
    """User model for OIDC authenticated users."""

    __tablename__ = "users"

    # OIDC identity
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    subject: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        doc="OIDC subject claim (sub)",
    )
    issuer: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
        doc="OIDC issuer URL",
    )

    # Profile
    display_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    avatar_url: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
    )

    # Status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        index=True,
    )
    is_global_admin: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        doc="Global admin has full access regardless of environment roles",
    )

    # Timestamps
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    sessions: Mapped[list["Session"]] = relationship(
        "Session",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    user_roles: Mapped[list["UserRole"]] = relationship(
        "UserRole",
        back_populates="user",
        foreign_keys="UserRole.user_id",
        cascade="all, delete-orphan",
    )
    api_tokens: Mapped[list["ApiToken"]] = relationship(
        "ApiToken",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        # Unique constraint on subject + issuer combination
        {"sqlite_autoincrement": True},
    )

    def __repr__(self) -> str:
        return f"<User(email='{self.email}', subject='{self.subject}')>"
