"""Statistics repositories for topics, subscriptions, and brokers."""

from datetime import datetime, timedelta, timezone
from typing import Any, Sequence
from uuid import UUID

from sqlalchemy import and_, delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.stats import Aggregation, BrokerStats, SubscriptionStats, TopicStats
from app.repositories.base import BaseRepository


class TopicStatsRepository(BaseRepository[TopicStats]):
    """Repository for topic statistics operations."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(TopicStats, session)

    async def batch_insert(self, stats_list: list[dict[str, Any]]) -> int:
        """Batch insert topic statistics."""
        if not stats_list:
            return 0

        stmt = insert(TopicStats).values(stats_list)
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount

    async def get_latest_by_topic(
        self,
        tenant: str,
        namespace: str,
        topic: str,
    ) -> TopicStats | None:
        """Get latest stats for a specific topic."""
        query = (
            select(TopicStats)
            .where(
                and_(
                    TopicStats.tenant == tenant,
                    TopicStats.namespace == namespace,
                    TopicStats.topic == topic,
                )
            )
            .order_by(TopicStats.collected_at.desc())
            .limit(1)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_latest_by_namespace(
        self,
        tenant: str,
        namespace: str,
    ) -> list[TopicStats]:
        """Get latest stats for all topics in a namespace."""
        # Subquery to get latest collected_at for each topic
        subquery = (
            select(
                TopicStats.topic,
                func.max(TopicStats.collected_at).label("max_collected"),
            )
            .where(
                and_(
                    TopicStats.tenant == tenant,
                    TopicStats.namespace == namespace,
                )
            )
            .group_by(TopicStats.topic)
            .subquery()
        )

        query = (
            select(TopicStats)
            .join(
                subquery,
                and_(
                    TopicStats.topic == subquery.c.topic,
                    TopicStats.collected_at == subquery.c.max_collected,
                ),
            )
            .where(
                and_(
                    TopicStats.tenant == tenant,
                    TopicStats.namespace == namespace,
                )
            )
        )

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def delete_older_than(self, days: int) -> int:
        """Delete stats older than specified days."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        result = await self.session.execute(
            delete(TopicStats).where(TopicStats.collected_at < cutoff)
        )
        await self.session.flush()
        return result.rowcount


class SubscriptionStatsRepository(BaseRepository[SubscriptionStats]):
    """Repository for subscription statistics operations."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(SubscriptionStats, session)

    async def batch_insert(self, stats_list: list[dict[str, Any]]) -> int:
        """Batch insert subscription statistics."""
        if not stats_list:
            return 0

        stmt = insert(SubscriptionStats).values(stats_list)
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount

    async def get_latest_by_topic(
        self,
        tenant: str,
        namespace: str,
        topic: str,
    ) -> list[SubscriptionStats]:
        """Get latest stats for all subscriptions of a topic."""
        subquery = (
            select(
                SubscriptionStats.subscription,
                func.max(SubscriptionStats.collected_at).label("max_collected"),
            )
            .where(
                and_(
                    SubscriptionStats.tenant == tenant,
                    SubscriptionStats.namespace == namespace,
                    SubscriptionStats.topic == topic,
                )
            )
            .group_by(SubscriptionStats.subscription)
            .subquery()
        )

        query = (
            select(SubscriptionStats)
            .join(
                subquery,
                and_(
                    SubscriptionStats.subscription == subquery.c.subscription,
                    SubscriptionStats.collected_at == subquery.c.max_collected,
                ),
            )
            .where(
                and_(
                    SubscriptionStats.tenant == tenant,
                    SubscriptionStats.namespace == namespace,
                    SubscriptionStats.topic == topic,
                )
            )
        )

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def delete_older_than(self, days: int) -> int:
        """Delete stats older than specified days."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        result = await self.session.execute(
            delete(SubscriptionStats).where(SubscriptionStats.collected_at < cutoff)
        )
        await self.session.flush()
        return result.rowcount


class BrokerStatsRepository(BaseRepository[BrokerStats]):
    """Repository for broker statistics operations."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(BrokerStats, session)

    async def batch_insert(self, stats_list: list[dict[str, Any]]) -> int:
        """Batch insert broker statistics."""
        if not stats_list:
            return 0

        stmt = insert(BrokerStats).values(stats_list)
        result = await self.session.execute(stmt)
        await self.session.flush()
        return result.rowcount

    async def get_latest_all(self) -> list[BrokerStats]:
        """Get latest stats for all brokers."""
        subquery = (
            select(
                BrokerStats.broker_url,
                func.max(BrokerStats.collected_at).label("max_collected"),
            )
            .group_by(BrokerStats.broker_url)
            .subquery()
        )

        query = select(BrokerStats).join(
            subquery,
            and_(
                BrokerStats.broker_url == subquery.c.broker_url,
                BrokerStats.collected_at == subquery.c.max_collected,
            ),
        )

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_latest_by_broker(self, broker_url: str) -> BrokerStats | None:
        """Get latest stats for a specific broker."""
        query = (
            select(BrokerStats)
            .where(BrokerStats.broker_url == broker_url)
            .order_by(BrokerStats.collected_at.desc())
            .limit(1)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def delete_older_than(self, days: int) -> int:
        """Delete stats older than specified days."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        result = await self.session.execute(
            delete(BrokerStats).where(BrokerStats.collected_at < cutoff)
        )
        await self.session.flush()
        return result.rowcount


class AggregationRepository(BaseRepository[Aggregation]):
    """Repository for precomputed aggregation operations."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Aggregation, session)

    async def upsert(
        self,
        environment_id: UUID,
        aggregation_type: str,
        aggregation_key: str,
        topic_count: int,
        total_backlog: int,
        total_msg_rate_in: float,
        total_msg_rate_out: float,
        total_storage_size: int,
    ) -> Aggregation:
        """Insert or update an aggregation."""
        # Try to find existing
        query = select(Aggregation).where(
            and_(
                Aggregation.environment_id == environment_id,
                Aggregation.aggregation_type == aggregation_type,
                Aggregation.aggregation_key == aggregation_key,
            )
        )
        result = await self.session.execute(query)
        existing = result.scalar_one_or_none()

        if existing:
            existing.topic_count = topic_count
            existing.total_backlog = total_backlog
            existing.total_msg_rate_in = total_msg_rate_in
            existing.total_msg_rate_out = total_msg_rate_out
            existing.total_storage_size = total_storage_size
            existing.computed_at = datetime.now(timezone.utc)
            await self.session.flush()
            await self.session.refresh(existing)
            return existing
        else:
            return await self.create(
                environment_id=environment_id,
                aggregation_type=aggregation_type,
                aggregation_key=aggregation_key,
                topic_count=topic_count,
                total_backlog=total_backlog,
                total_msg_rate_in=total_msg_rate_in,
                total_msg_rate_out=total_msg_rate_out,
                total_storage_size=total_storage_size,
            )

    async def get_by_tenant(self, tenant: str) -> Aggregation | None:
        """Get aggregation for a tenant."""
        query = (
            select(Aggregation)
            .where(
                and_(
                    Aggregation.aggregation_type == "tenant",
                    Aggregation.aggregation_key == tenant,
                )
            )
            .order_by(Aggregation.computed_at.desc())
            .limit(1)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_by_namespace(self, tenant: str, namespace: str) -> Aggregation | None:
        """Get aggregation for a namespace."""
        key = f"{tenant}/{namespace}"
        query = (
            select(Aggregation)
            .where(
                and_(
                    Aggregation.aggregation_type == "namespace",
                    Aggregation.aggregation_key == key,
                )
            )
            .order_by(Aggregation.computed_at.desc())
            .limit(1)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_all_tenants(self) -> list[Aggregation]:
        """Get all tenant aggregations."""
        query = (
            select(Aggregation)
            .where(Aggregation.aggregation_type == "tenant")
            .order_by(Aggregation.aggregation_key)
        )
        result = await self.session.execute(query)
        return list(result.scalars().all())
