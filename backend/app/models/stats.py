"""Statistics models for topics, subscriptions, brokers, and aggregations."""

from datetime import datetime, timezone
import uuid

from sqlalchemy import (
    BigInteger,
    DateTime,
    Double,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class TopicStats(BaseModel):
    """Topic statistics snapshot."""

    __tablename__ = "topic_stats"

    environment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("environments.id", ondelete="CASCADE"),
        nullable=False,
    )
    tenant: Mapped[str] = mapped_column(String(255), nullable=False)
    namespace: Mapped[str] = mapped_column(String(255), nullable=False)
    topic: Mapped[str] = mapped_column(String(512), nullable=False)
    partition_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Message rates
    msg_rate_in: Mapped[float] = mapped_column(Double, default=0.0, nullable=False)
    msg_rate_out: Mapped[float] = mapped_column(Double, default=0.0, nullable=False)
    msg_throughput_in: Mapped[float] = mapped_column(Double, default=0.0, nullable=False)
    msg_throughput_out: Mapped[float] = mapped_column(Double, default=0.0, nullable=False)

    # Storage
    storage_size: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    backlog_size: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)

    # Timestamp
    collected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("idx_topic_stats_collected", collected_at.desc()),
        Index("idx_topic_stats_topic", "tenant", "namespace", "topic"),
        Index("idx_topic_stats_env", "environment_id"),
    )

    def __repr__(self) -> str:
        return f"<TopicStats(topic='{self.topic}', collected_at='{self.collected_at}')>"


class SubscriptionStats(BaseModel):
    """Subscription statistics snapshot."""

    __tablename__ = "subscription_stats"

    environment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("environments.id", ondelete="CASCADE"),
        nullable=False,
    )
    tenant: Mapped[str] = mapped_column(String(255), nullable=False)
    namespace: Mapped[str] = mapped_column(String(255), nullable=False)
    topic: Mapped[str] = mapped_column(String(512), nullable=False)
    subscription: Mapped[str] = mapped_column(String(255), nullable=False)

    # Message rates
    msg_rate_out: Mapped[float] = mapped_column(Double, default=0.0, nullable=False)
    msg_throughput_out: Mapped[float] = mapped_column(Double, default=0.0, nullable=False)

    # Backlog and consumers
    msg_backlog: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    consumer_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Timestamp
    collected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("idx_sub_stats_collected", collected_at.desc()),
        Index("idx_sub_stats_subscription", "tenant", "namespace", "topic", "subscription"),
        Index("idx_sub_stats_env", "environment_id"),
    )

    def __repr__(self) -> str:
        return f"<SubscriptionStats(subscription='{self.subscription}', collected_at='{self.collected_at}')>"


class BrokerStats(BaseModel):
    """Broker statistics snapshot."""

    __tablename__ = "broker_stats"

    environment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("environments.id", ondelete="CASCADE"),
        nullable=False,
    )
    broker_url: Mapped[str] = mapped_column(String(512), nullable=False)

    # Resource usage
    cpu_usage: Mapped[float] = mapped_column(Double, default=0.0, nullable=False)
    memory_usage: Mapped[float] = mapped_column(Double, default=0.0, nullable=False)
    direct_memory_usage: Mapped[float] = mapped_column(Double, default=0.0, nullable=False)

    # Message rates
    msg_rate_in: Mapped[float] = mapped_column(Double, default=0.0, nullable=False)
    msg_rate_out: Mapped[float] = mapped_column(Double, default=0.0, nullable=False)

    # Connections
    connection_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Timestamp
    collected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("idx_broker_stats_collected", collected_at.desc()),
        Index("idx_broker_stats_broker", "broker_url"),
        Index("idx_broker_stats_env", "environment_id"),
    )

    def __repr__(self) -> str:
        return f"<BrokerStats(broker_url='{self.broker_url}', collected_at='{self.collected_at}')>"


class Aggregation(BaseModel):
    """Precomputed aggregations for tenants and namespaces."""

    __tablename__ = "aggregations"

    environment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("environments.id", ondelete="CASCADE"),
        nullable=False,
    )
    aggregation_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )  # "tenant" or "namespace"
    aggregation_key: Mapped[str] = mapped_column(
        String(512),
        nullable=False,
    )  # tenant name or "tenant/namespace"

    # Aggregated metrics
    topic_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_backlog: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    total_msg_rate_in: Mapped[float] = mapped_column(Double, default=0.0, nullable=False)
    total_msg_rate_out: Mapped[float] = mapped_column(Double, default=0.0, nullable=False)
    total_storage_size: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)

    # Timestamp
    computed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("idx_agg_type_key", "aggregation_type", "aggregation_key"),
        Index("idx_agg_computed", computed_at.desc()),
        Index("idx_agg_env", "environment_id"),
    )

    def __repr__(self) -> str:
        return f"<Aggregation(type='{self.aggregation_type}', key='{self.aggregation_key}')>"
