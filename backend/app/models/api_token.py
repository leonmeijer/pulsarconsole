"""API Token model for programmatic access."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel

if TYPE_CHECKING:
    from app.models.user import User


class ApiToken(BaseModel):
    """API Token for programmatic access to Pulsar Console."""

    __tablename__ = "api_tokens"

    # User reference
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Token identification
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        doc="User-friendly name for the token",
    )
    token_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        unique=True,
        index=True,
        doc="SHA256 hash of the token",
    )
    token_prefix: Mapped[str] = mapped_column(
        String(8),
        nullable=False,
        doc="First 8 chars of token for display (e.g., 'pc_abc1...')",
    )

    # Expiration (NULL = never expires)
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        index=True,
    )

    # Usage tracking
    last_used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Status
    is_revoked: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # Optional scopes for fine-grained access
    scopes: Mapped[list[str] | None] = mapped_column(
        ARRAY(String),
        nullable=True,
        doc="Optional scopes to limit token access",
    )

    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="api_tokens",
    )

    def __repr__(self) -> str:
        return f"<ApiToken(name='{self.name}', user_id='{self.user_id}', prefix='{self.token_prefix}')>"

    @property
    def is_expired(self) -> bool:
        """Check if token has expired."""
        if self.expires_at is None:
            return False
        from datetime import timezone
        return datetime.now(timezone.utc) > self.expires_at

    @property
    def is_valid(self) -> bool:
        """Check if token is valid (not expired and not revoked)."""
        return not self.is_expired and not self.is_revoked

    @property
    def display_token(self) -> str:
        """Get display-safe token representation."""
        return f"{self.token_prefix}..."
