"""Message browser schemas."""

from typing import Any, Literal

from pydantic import Field

from app.schemas.common import BaseSchema


class MessagePayload(BaseSchema):
    """Message payload with decoded content."""

    type: Literal["json", "text", "binary"]
    content: Any
    raw: str | None = None
    size: int | None = None


class MessageInfo(BaseSchema):
    """Message information."""

    index: int
    message_id: str | None = None
    publish_time: str | None = None
    producer_name: str | None = None
    properties: dict[str, str] = Field(default_factory=dict)
    payload: MessagePayload
    key: str | None = None
    event_time: str | None = None
    redelivery_count: int = 0


class BrowseMessagesRequest(BaseSchema):
    """Schema for browsing messages."""

    count: int = Field(default=10, ge=1, le=100, description="Number of messages to browse")
    start_message_id: str | None = Field(
        default=None, description="Start from this message ID"
    )


class BrowseMessagesResponse(BaseSchema):
    """Response for browsing messages."""

    topic: str
    subscription: str
    messages: list[MessageInfo]
    message_count: int
    rate_limit_remaining: int


class ExamineMessagesRequest(BaseSchema):
    """Schema for examining messages without subscription."""

    initial_position: Literal["earliest", "latest"] = Field(
        default="latest", description="Initial position"
    )
    count: int = Field(default=10, ge=1, le=100, description="Number of messages")


class ExamineMessagesResponse(BaseSchema):
    """Response for examining messages."""

    topic: str
    initial_position: str
    messages: list[MessageInfo]
    message_count: int
    rate_limit_remaining: int


class GetMessageResponse(BaseSchema):
    """Response for getting a specific message."""

    topic: str
    message_id: str
    publish_time: str | None = None
    producer_name: str | None = None
    properties: dict[str, str] = Field(default_factory=dict)
    payload: MessagePayload
    key: str | None = None
    event_time: str | None = None


class LastMessageIdResponse(BaseSchema):
    """Response for getting last message ID."""

    topic: str
    ledger_id: int | None = None
    entry_id: int | None = None
    partition_index: int = -1
    message_id: str
