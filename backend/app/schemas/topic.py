"""Topic schemas."""

from pydantic import Field

from app.schemas.common import BaseSchema, StatsBase


class TopicStats(StatsBase):
    """Topic statistics."""

    average_msg_size: float = 0
    storage_size: int = 0
    backlog_size: int = 0


class TopicInternalStats(BaseSchema):
    """Topic internal statistics."""

    entries_added_counter: int = 0
    number_of_entries: int = 0
    total_size: int = 0
    current_ledger_entries: int = 0
    current_ledger_size: int = 0


class ProducerInfo(BaseSchema):
    """Producer information."""

    producer_id: int | None = None
    producer_name: str | None = None
    address: str | None = None
    msg_rate_in: float = 0
    msg_throughput_in: float = 0


class SubscriptionInfo(BaseSchema):
    """Subscription brief information."""

    name: str
    type: str = "Exclusive"
    msg_backlog: int = 0
    msg_rate_out: float = 0
    consumer_count: int = 0


class TopicBase(BaseSchema):
    """Base topic schema."""

    name: str = Field(..., min_length=1, max_length=128, description="Topic name")


class TopicCreate(TopicBase):
    """Schema for creating a topic."""

    persistent: bool = Field(default=True, description="Whether topic is persistent")
    partitions: int = Field(
        default=0, ge=0, description="Number of partitions (0 for non-partitioned)"
    )


class TopicResponse(TopicBase, StatsBase):
    """Topic response schema."""

    tenant: str
    namespace: str
    full_name: str
    persistent: bool = True
    producer_count: int = 0
    subscription_count: int = 0
    storage_size: int = 0
    backlog_size: int = 0


class TopicDetailResponse(TopicBase):
    """Detailed topic response with full stats."""

    tenant: str
    namespace: str
    full_name: str
    persistent: bool = True
    stats: TopicStats
    internal_stats: TopicInternalStats
    producers: list[ProducerInfo] = Field(default_factory=list)
    subscriptions: list[SubscriptionInfo] = Field(default_factory=list)
    producer_count: int = 0
    subscription_count: int = 0


class TopicListResponse(BaseSchema):
    """Response for topic list."""

    topics: list[TopicResponse]
    total: int


class TopicPartitionUpdate(BaseSchema):
    """Schema for updating topic partitions."""

    partitions: int = Field(..., ge=1, description="New number of partitions")
