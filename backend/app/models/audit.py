"""Audit event model for tracking administrative actions."""

from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import DateTime, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class ActionType(str, Enum):
    """Types of audit actions."""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    READ = "read"
    SKIP_MESSAGES = "skip_messages"
    SKIP_ALL_MESSAGES = "skip_all_messages"
    RESET_CURSOR = "reset_cursor"
    EXPIRE_MESSAGES = "expire_messages"
    BROWSE_MESSAGES = "browse_messages"


class ResourceType(str, Enum):
    """Types of resources that can be audited."""
    ENVIRONMENT = "environment"
    TENANT = "tenant"
    NAMESPACE = "namespace"
    TOPIC = "topic"
    SUBSCRIPTION = "subscription"
    MESSAGE = "message"
    BROKER = "broker"


class AuditEvent(BaseModel):
    """Audit event for tracking all administrative actions."""

    __tablename__ = "audit_events"

    action: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    resource_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        index=True,
    )
    resource_id: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
    )
    request_params: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    __table_args__ = (
        Index("idx_audit_resource", "resource_type", "resource_id"),
        Index("idx_audit_timestamp_desc", timestamp.desc()),
    )

    def __repr__(self) -> str:
        return (
            f"<AuditEvent(action='{self.action}', "
            f"resource_type='{self.resource_type}', "
            f"resource_id='{self.resource_id}')>"
        )
