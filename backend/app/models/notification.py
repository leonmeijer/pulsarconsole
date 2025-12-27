"""Notification model for alerts and warnings."""

from datetime import datetime, timezone
from enum import Enum

from sqlalchemy import Boolean, DateTime, Index, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class NotificationType(str, Enum):
    """Types of notifications."""
    CONSUMER_DISCONNECT = "consumer_disconnect"
    BROKER_HEALTH = "broker_health"
    STORAGE_WARNING = "storage_warning"
    BACKLOG_WARNING = "backlog_warning"
    ERROR = "error"
    INFO = "info"


class NotificationSeverity(str, Enum):
    """Severity levels for notifications."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class Notification(BaseModel):
    """Notification for alerts and system events."""

    __tablename__ = "notifications"

    type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    severity: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    message: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    resource_type: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    resource_id: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
    )
    metadata: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )
    is_read: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )
    is_dismissed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    __table_args__ = (
        Index("idx_notification_unread", "is_read", "is_dismissed"),
        Index("idx_notification_type_severity", "type", "severity"),
        Index("idx_notification_created_desc", created_at.desc()),
    )

    def __repr__(self) -> str:
        return (
            f"<Notification(type='{self.type}', "
            f"severity='{self.severity}', "
            f"title='{self.title[:30]}...')>"
        )
