"""Environment configuration model."""

from sqlalchemy import Boolean, String, Text, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column
import enum

from app.models.base import BaseModel


class AuthMode(str, enum.Enum):
    """Authentication mode for Pulsar cluster."""

    none = "none"
    token = "token"
    tls = "tls"


class Environment(BaseModel):
    """Environment configuration for Pulsar cluster connection."""

    __tablename__ = "environments"

    name: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        nullable=False,
        index=True,
    )
    admin_url: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
    )
    auth_mode: Mapped[AuthMode] = mapped_column(
        SQLEnum(AuthMode),
        default=AuthMode.none,
        nullable=False,
    )
    token_encrypted: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    ca_bundle_ref: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )

    def __repr__(self) -> str:
        return f"<Environment(name='{self.name}', admin_url='{self.admin_url}')>"
