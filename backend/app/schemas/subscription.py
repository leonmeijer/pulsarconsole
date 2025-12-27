"""Subscription schemas."""

from pydantic import Field

from app.schemas.common import BaseSchema


class ConsumerInfo(BaseSchema):
    """Consumer information."""

    consumer_name: str | None = None
    address: str | None = None
    connected_since: str | None = None
    msg_rate_out: float = 0
    msg_throughput_out: float = 0
    available_permits: int = 0
    unacked_messages: int = 0
    blocked_consumer_on_unacked_msgs: bool = False


class SubscriptionBase(BaseSchema):
    """Base subscription schema."""

    name: str = Field(..., min_length=1, max_length=64, description="Subscription name")


class SubscriptionCreate(SubscriptionBase):
    """Schema for creating a subscription."""

    message_id: str = Field(
        default="latest",
        description="Initial position (earliest/latest or messageId)",
    )


class SubscriptionResponse(SubscriptionBase):
    """Subscription response schema."""

    topic: str
    type: str = "Exclusive"
    msg_backlog: int = 0
    msg_rate_out: float = 0
    msg_throughput_out: float = 0
    msg_rate_expired: float = 0
    unacked_messages: int = 0
    consumer_count: int = 0
    is_durable: bool = True
    replicated: bool = False


class SubscriptionDetailResponse(SubscriptionResponse):
    """Detailed subscription response with consumers."""

    consumers: list[ConsumerInfo] = Field(default_factory=list)
    non_contiguous_deleted_messages_ranges: int = 0


class SubscriptionListResponse(BaseSchema):
    """Response for subscription list."""

    subscriptions: list[SubscriptionResponse]
    total: int


class SkipMessagesRequest(BaseSchema):
    """Schema for skipping messages."""

    count: int = Field(..., ge=1, description="Number of messages to skip")


class ResetCursorRequest(BaseSchema):
    """Schema for resetting cursor to timestamp."""

    timestamp: int = Field(..., description="Timestamp in milliseconds")


class ResetCursorToMessageIdRequest(BaseSchema):
    """Schema for resetting cursor to message ID."""

    message_id: str = Field(..., description="Message ID (ledgerId:entryId)")


class ExpireMessagesRequest(BaseSchema):
    """Schema for expiring messages."""

    expire_time_seconds: int = Field(
        ..., ge=1, description="Expire messages older than this (seconds)"
    )
