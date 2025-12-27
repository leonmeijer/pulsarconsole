"""Broker schemas."""

from pydantic import Field

from app.schemas.common import BaseSchema, StatsBase


class BrokerResponse(StatsBase):
    """Broker response schema."""

    url: str
    topics_count: int = 0
    bundles_count: int = 0
    producers_count: int = 0
    consumers_count: int = 0
    cpu_usage: float = 0
    memory_usage: float = 0
    direct_memory_usage: float = 0


class BrokerDetailResponse(BrokerResponse):
    """Detailed broker response."""

    jvm_heap_used: int = 0
    jvm_heap_max: int = 0
    owned_namespaces: list[str] = Field(default_factory=list)


class BrokerLoadResponse(BaseSchema):
    """Broker load information."""

    url: str
    cpu_usage: float = 0
    cpu_limit: float = 100
    memory_usage: float = 0
    memory_limit: float = 0
    direct_memory_usage: float = 0
    direct_memory_limit: float = 0
    bandwidth_in_usage: float = 0
    bandwidth_in_limit: float = 0
    bandwidth_out_usage: float = 0
    bandwidth_out_limit: float = 0
    msg_rate_in: float = 0
    msg_rate_out: float = 0
    msg_throughput_in: float = 0
    msg_throughput_out: float = 0
    topics_count: int = 0
    bundles_count: int = 0
    consumers_count: int = 0
    producers_count: int = 0
    last_update: str | None = None


class BrokerListResponse(BaseSchema):
    """Response for broker list."""

    brokers: list[BrokerResponse]
    total: int


class ClusterInfoResponse(BaseSchema):
    """Cluster information response."""

    clusters: list[str]
    broker_count: int
    brokers: list[BrokerResponse]
    total_topics: int
    total_producers: int
    total_consumers: int
    total_msg_rate_in: float
    total_msg_rate_out: float


class LeaderBrokerResponse(BaseSchema):
    """Leader broker response."""

    url: str | None = None
    broker_id: str | None = None


class BrokerConfigResponse(BaseSchema):
    """Broker configuration response."""

    config: dict
