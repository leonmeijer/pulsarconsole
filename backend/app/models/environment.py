"""Environment configuration model."""

from typing import TYPE_CHECKING

from sqlalchemy import Boolean, String, Text, Enum as SQLEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.oidc_provider import OIDCProvider
    from app.models.role import Role


class AuthMode(str, enum.Enum):
    """Authentication mode for Pulsar cluster."""

    none = "none"
    token = "token"
    oidc = "oidc"
    tls = "tls"


class OIDCMode(str, enum.Enum):
    """OIDC operation mode."""

    none = "none"  # No OIDC
    console_only = "console_only"  # OIDC for Console, service token for Pulsar
    passthrough = "passthrough"  # OIDC token forwarded to Pulsar


class RBACSyncMode(str, enum.Enum):
    """RBAC synchronization mode."""

    console_only = "console_only"  # Permissions only in Console
    sync_to_pulsar = "sync_to_pulsar"  # Write permissions to Pulsar
    read_from_pulsar = "read_from_pulsar"  # Read permissions from Pulsar


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
        doc="Encrypted Pulsar authentication token",
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

    # RBAC Configuration
    rbac_enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        doc="Enable RBAC for this environment",
    )

    # OIDC Mode (only applicable when auth_mode = 'oidc')
    oidc_mode: Mapped[OIDCMode] = mapped_column(
        SQLEnum(OIDCMode),
        default=OIDCMode.none,
        nullable=False,
        doc="How OIDC tokens are used",
    )

    # RBAC Sync Mode (only applicable when rbac_enabled = True)
    rbac_sync_mode: Mapped[RBACSyncMode] = mapped_column(
        SQLEnum(RBACSyncMode),
        default=RBACSyncMode.console_only,
        nullable=False,
        doc="How RBAC permissions are synchronized",
    )

    # Service Account Token (for console_only mode)
    service_account_token_encrypted: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        doc="Encrypted service account token for Pulsar API calls (used in console_only OIDC mode)",
    )

    # Pulsar Token Secret Key (for generating Pulsar JWT tokens)
    pulsar_token_secret_key_encrypted: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        doc="Encrypted secret key for generating Pulsar JWT tokens",
    )

    # Relationships
    oidc_provider: Mapped["OIDCProvider | None"] = relationship(
        "OIDCProvider",
        back_populates="environment",
        uselist=False,
        cascade="all, delete-orphan",
    )
    roles: Mapped[list["Role"]] = relationship(
        "Role",
        back_populates="environment",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Environment(name='{self.name}', admin_url='{self.admin_url}')>"
